"""
Money Man OS - prototype runner.

  python3 run.py

Does two things:
  1) INTAKE DEMO - "uploads" the sample documents, shows what Money Man pulls
     out of each, and the targeted follow-up it asks for anything missing.
  2) LIQUIDITY MAXIMIZER - builds the wedge-user scenario, computes the exact
     day to pay each bill (preserve cash + lift credit, no overdraft), prints
     the blunt report, and writes report.html (open it in a browser).
"""

import os
import intake
import scenario
from liquidity_maximizer import build_plan, render_console, render_html

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "sample_docs")


def intake_demo():
    print("=" * 64)
    print("  INTAKE  ·  upload a doc, Money Man reads it, asks only what's missing")
    print("=" * 64)
    for fname in sorted(os.listdir(DOCS)):
        if not fname.endswith(".txt"):
            continue
        with open(os.path.join(DOCS, fname)) as fh:
            text = fh.read()
        doctype, fields = intake.extract(text)
        missing = intake.missing_required(doctype, fields)
        got = {k: v for k, v in fields.items()
               if v not in (None, "") and k in intake.REQUIRED.get(doctype, [])}
        print(f"\n  uploaded: {fname}  ->  detected: {doctype}")
        for k, v in got.items():
            print(f"     read   {k:<16} {v}")
        if missing:
            print("     Money Man needs a little more:")
            for q in intake.followups(missing):
                print(f"       ? {q}")
        else:
            print("     all set - nothing to ask.")
    print("\n  (In the app, tier 1 is bank linking with zero typing; this is the")
    print("   document-upload tier with smart follow-ups as the fallback.)\n")


def run_scenario(label, builder, html_name):
    print("\n\n" + "#" * 64)
    print(f"#  SCENARIO: {label}")
    print("#" * 64)
    account, incomes, bills, cards = builder()
    plan = build_plan(account, incomes, bills, cards, scenario.TODAY)
    print(render_console(plan))
    out = os.path.join(HERE, html_name)
    with open(out, "w") as fh:
        fh.write(render_html(plan))
    print(f"\n  Visual report: {out}")


def main():
    intake_demo()
    # Same engine, two weeks. The "good week" shows the credit-timing move fire;
    # the "tight week" shows it honestly refuse to drain the buffer for a score.
    run_scenario("GOOD WEEK  (cash is flowing - watch the credit move fire)",
                 scenario.build_good, "report_good.html")
    run_scenario("TIGHT WEEK (too broke to chase a score - it says so)",
                 scenario.build_tight, "report_tight.html")
    print("\n  Open the two report_*.html files in a browser to compare.")


if __name__ == "__main__":
    main()
