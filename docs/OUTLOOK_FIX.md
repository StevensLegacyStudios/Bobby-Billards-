# Fixing "Claude for Outlook" (the add-in you can't see)

**Who this is for:** Shawn. You expected a Claude button inside Outlook and it is not there — or nothing happens when you click it. This doc explains why and gives you an exact fix list.

---

## The key insight (read this first)

**What IT approved is not the same thing as the Outlook add-in.**

IT approved two apps: **"Claude for Office"** and the **"M365 MCP Client for Claude"**. Those power the *connector* — the thing that lets Claude on claude.ai read your SharePoint, OneDrive, Teams, and mail when you chat with it. That approval is done and working.

The **Claude for Outlook add-in** — the button *inside* Outlook itself — is a completely separate deployment. Approving the connector does nothing to install the add-in, and installing the add-in does nothing for the connector. They are different apps with different switches.

For the add-in to work, **all three** of these must be true:

| # | Requirement | Detail |
|---|---|---|
| 1 | **It must be deployed** | Either IT deploys it from Microsoft 365 admin center > **Settings > Integrated apps**, or you self-install it from AppSource — the listing is "Claude for Outlook" (ID **WA200010724**). Many companies block self-install, so IT deployment is the usual path. |
| 2 | **You need a paid Claude plan** | Pro, Max, Team, or Enterprise. A **Free** Claude account will fail at sign-in — it looks like a bug, but it is a plan restriction by design. |
| 3 | **You need a work mailbox** | Your @unitedmech-style Microsoft 365 work account. Personal @outlook.com or @hotmail.com mailboxes are not supported. |

**Which Outlooks it works in:** Outlook on the web — yes. New Outlook for Windows — yes. Classic desktop Outlook for Windows — yes, as long as it's the Microsoft 365 version. Outlook for Mac — yes. **Outlook on your phone — no**, not supported. If it's missing on mobile, that is expected, not a fault.

Full details are in the official help article: [Use Claude for Outlook — Claude Help Center](https://support.claude.com/en/articles/14855664-use-claude-for-outlook).

---

## The fix list — work top to bottom

These are ordered by how likely each one is to be your problem. Stop as soon as it works.

1. **Check your Claude plan.** On claude.ai, click your initials (bottom-left) > **Settings > Billing**. If it says Free, that is the whole problem — the add-in needs Pro, Max, Team, or Enterprise. Sign-in fails on Free by design.
2. **Check which mailbox you're in.** The add-in only works on your work account. In classic Outlook: **File > Account Settings**. In new Outlook or the web: **Settings gear > Accounts**. If you're looking at a personal mailbox, switch to the work one.
3. **Wait, then restart.** If IT deployed it recently, rollout can take **up to 24 hours**. Fully quit Outlook and reopen it. In the browser, press **Ctrl+F5**.
4. **Look in the right place.** New Outlook / web: open any email > click **Apps** (or "More apps") on the message toolbar > **Claude**. Classic Outlook on Windows: open an email > **Home ribbon** > look for the Claude button (or under **All Apps**). Mac: **Home ribbon > Claude**. Phone: not supported — don't look there.
5. **Try installing it yourself.** In Outlook: message toolbar > **Apps > Get add-ins** (or "Add apps") > search **"Claude"** > **Add**. If the search finds nothing, self-install is blocked at your company — skip to the "What to send IT" block below.
6. **Shows in new Outlook / web but missing in classic desktop?** First confirm it's really deployed: in new Outlook check **Home > More Apps**. If Claude is there, go back to classic Outlook > **File > Manage Add-ins** (this opens a web page), toggle Claude **on**, then restart Outlook.
7. **The Claude pane opens but is blank or frozen.** Close the pane and reopen it. Click any ribbon dropdown and pick the refresh option — this reloads the pane (known bug, known workaround). If it keeps happening on classic Windows Outlook: close Outlook, press **Windows+R**, type `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef`, press Enter, delete everything in that folder, and restart Outlook.
8. **Stuck in a sign-in loop.** Sign out of Claude inside the pane and sign back in. Make sure Office is signed in with **only** your work account: **File > Office Account** > sign out of any personal accounts. Still looping? Try Outlook on the web in a private/incognito browser window to rule out cached logins.
9. **Basic email help works, but triage / mailbox search / "find a time" errors out.** That is an IT item, not yours: those features need a separate Microsoft Graph admin consent that only a Global Administrator can grant. See the "What to send IT" block below.
10. **Nothing appears for anyone at the company, not just you.** Also an IT item — the deployment itself, an Exchange Web Services (EWS) setting, or a Conditional Access policy is in the way. Send IT the block below.
11. **Last resort: remove and re-add.** **Apps > Get add-ins > Manage my add-ins** > remove Claude, restart Outlook, reinstall. If it still fails, contact support through support.claude.com.

---

## What to send IT (copy-paste this)

> Hi — I'm trying to use the **Claude for Outlook add-in**. I know we already approved "Claude for Office" and the "M365 MCP Client for Claude" — those are the *connector* apps and they're separate from this add-in. The add-in needs its own deployment. Could you check four things:
>
> 1. **Deploy the add-in:** Microsoft 365 admin center > **Settings > Integrated apps** > search AppSource for **"Claude for Outlook"** (listing ID WA200010724) > Deploy to me (or my group). If the store is blocked, there's an "Upload custom apps > Office Add-in > manifest file" path using the manifest Anthropic provides. Rollout can take up to 24 hours.
> 2. **Confirm Exchange Web Services (EWS) is enabled** for the org and for my mailbox. There's a known Microsoft issue where add-ins fail to appear at all when EWS is off.
> 3. **Check Conditional Access** isn't blocking the Claude apps in Entra.
> 4. **For the inbox-wide features** (triage, mailbox search, scheduling): a Global Admin needs to grant tenant-wide admin consent via the **admin-consent URL in Anthropic's onboarding materials** (delegated scopes: Mail.ReadWrite, Calendars.Read, People.Read, User.Read, offline_access). This is a separate step from deploying the add-in — the add-in works for single emails without it, but the cross-mailbox features won't.
>
> All permissions are delegated — Claude can never see anything I can't see myself. Reference: https://support.claude.com/en/articles/14855664-use-claude-for-outlook

---

## The important part: none of this blocks the automation

**The autonomous pipeline in [SETUP.md](SETUP.md) does NOT depend on this add-in.** The pipeline runs in Power Automate inside our own tenant and calls the Claude API directly — it triages email, logs to SharePoint, drafts replies, and chases vendors whether or not this add-in ever gets installed.

The add-in is a **nice-to-have for interactive work**: sitting in Outlook and asking Claude to summarize a long thread about the Ferguson floor drains quote on job 11836-15, or to draft a quick reply about the Kohler K-30810 lead time — with you driving, in the moment. That's the Phase 0 "use Claude interactively today" idea from [MASTER_PLAN.md](MASTER_PLAN.md). Useful, but optional. If IT drags their feet on it, the build in SETUP.md moves ahead anyway.
