/**
 * Homography transformation layer.
 *
 * Projects angled camera-frame pixel coordinates onto the flat 2:1 canonical
 * slate canvas (X ∈ [0, 200], Y ∈ [0, 100]) using a 3x3 projective matrix in
 * the same row-major layout OpenCV's getPerspectiveTransform produces. The
 * matrix is solved with a direct linear transform (DLT) over the four table
 * corner correspondences via Gaussian elimination — no native deps required,
 * so it runs identically in the serverless worker and in tests.
 */

export type PixelPoint = [number, number];
export type CanvasPoint = [number, number];

/** Row-major 3x3 matrix, OpenCV-style. */
export type HomographyMatrix = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export const SLATE_CANVAS = { width: 200, height: 100 } as const;

/** Canonical destination corners: top-left, top-right, bottom-right, bottom-left. */
export const SLATE_CORNERS: CanvasPoint[] = [
  [0, 0],
  [SLATE_CANVAS.width, 0],
  [SLATE_CANVAS.width, SLATE_CANVAS.height],
  [0, SLATE_CANVAS.height],
];

/**
 * Solve the 8-DOF homography H such that H * src ≈ dst for the four given
 * correspondences. Equivalent to cv2.getPerspectiveTransform(src, dst).
 */
export function solveHomography(
  src: PixelPoint[],
  dst: CanvasPoint[]
): HomographyMatrix {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("Homography requires exactly 4 point correspondences");
  }

  // Build the standard 8x9 DLT system A * h = b with h33 fixed at 1.
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = gaussianSolve(a, b);
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

/** Apply the projective transform to a pixel-space point. */
export function projectPoint(H: HomographyMatrix, point: PixelPoint): CanvasPoint {
  const [x, y] = point;
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  if (Math.abs(w) < 1e-12) {
    throw new Error("Point projects to infinity — degenerate homography");
  }
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  ];
}

/** Clamp a projected point onto the slate canvas bounds. */
export function clampToSlate(point: CanvasPoint): CanvasPoint {
  return [
    Math.min(SLATE_CANVAS.width, Math.max(0, point[0])),
    Math.min(SLATE_CANVAS.height, Math.max(0, point[1])),
  ];
}

/** Gaussian elimination with partial pivoting for the n x n system A x = b. */
function gaussianSolve(aInput: number[][], bInput: number[]): number[] {
  const n = bInput.length;
  const a = aInput.map((row) => row.slice());
  const b = bInput.slice();

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error("Degenerate corner configuration — points may be collinear");
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k < n; k++) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}
