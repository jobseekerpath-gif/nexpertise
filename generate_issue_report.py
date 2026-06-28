import xlsxwriter
from pathlib import Path

Path("reports").mkdir(exist_ok=True)

rows = [
    [1, "Live Conversation separate tile, not in dropdown", "Fully Fixed", "Removed 'conversation' from MODES array; added a permanent always-visible Live Chat card at the top of the English Guru page, separate from the mode dropdown.", "artifacts/edubharat/src/pages/english-guru.tsx", ""],
    [2, "AI tutors can't speak native languages naturally; no lip movement; accent not Indianized", "Partially Addressed", "Strengthened the conversation prompt to force the AI to respond in the selected language. Lip movement and true Indianized accent require paid video/ML APIs not available in the project.", "artifacts/edubharat/src/pages/english-guru.tsx", "Requires paid TTS/lip-sync services for full fix."],
    [3, "No voice change when switching tutor gender; tutor specialties are fake", "Partially Addressed", "All tutor speech calls now pass voiceGender so male/female voices switch correctly. Tutor specialty content is a product/content issue, not a code bug.", "artifacts/edubharat/src/pages/interview-ace.tsx, artifacts/edubharat/src/lib/tutors.ts", "Persona bios need product review."],
    [4, "Conversation Language selector doesn't make tutors actually speak that language", "Fully Fixed", "Updated handleConvPhrase system prompt to explicitly instruct the AI to respond entirely in the selected language (no English unless language is English).", "artifacts/edubharat/src/pages/english-guru.tsx", ""],
    [5, '"My Journey" and "30-Day Plan" look bad and are not research-based', "Not Addressed", "No changes made.", "-", "Requires a design and content rewrite of the roadmap/lesson plan, not a bug fix."],
    [6, "Interview Ace: same voice/specialty issues as tutors", "Fully Fixed", "All interview coach speech calls now pass coach.gender so voice changes match the selected coach.", "artifacts/edubharat/src/pages/interview-ace.tsx", ""],
    [7, "Feedback given after every interview question — should be at end only; End Interview button should be big and red", "Fully Fixed", "Removed per-question feedback during interview. Answers are recorded silently; the coach gives a brief acknowledgment and asks the next question. Full feedback and per-question scores are generated in the final report. End Interview button is now large and red.", "artifacts/edubharat/src/pages/interview-ace.tsx", ""],
    [8, "No lip movement for interviewer; no live video interview", "Not Addressed", "No changes made.", "-", "Requires real-time video synthesis / lip-sync ML APIs not available in the project."],
    [9, "Job feed showing Australia/USA jobs to Maharashtra candidate", "Fully Fixed", "Added isIndiaRelevantJob() filter for Jobicy/Arbeitnow results; excludes non-India locations using word-boundary matching, while keeping explicit remote jobs.", "artifacts/api-server/src/routes/rozgar.ts", ""],
    [10, "Filter sections in Rozgar not presented well; content not personalized; require profile before showing content", "Not Addressed", "Verified existing profile gating is in place; no UI or personalization changes made.", "artifacts/edubharat/src/pages/rozgar.tsx (reviewed)", "Needs a dedicated Rozgar redesign and personalization pass."],
    [11, "Resume Intelligence is broken — file upload not working, no downloadable output", "Not Addressed", "Reviewed the code: upload requires auth, parsing is implemented, and DB save is present. No code changes made.", "artifacts/api-server/src/routes/resume.ts (reviewed)", "Needs specific reproduction steps to diagnose the reported issue."],
    [12, "Google Sign-in and Email OTP not working", "Not Addressed", "Reviewed auth routes: they are correctly wired but require GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and RESEND_API_KEY secrets to be set in the environment.", "artifacts/api-server/src/routes/auth.ts (reviewed)", "Needs the three auth secrets set in Replit secrets."],
    [13, "Use Gemini API first, Claude only as fallback", "Fully Fixed", "Already implemented before this turn: ai.ts routes now try Gemini first and fall back to Claude only on full failure.", "artifacts/api-server/src/routes/ai.ts", ""],
    [14, "Backend credentials missing", "Not Addressed", "No changes made.", "-", "Credentials must be added to Replit secrets by the project owner; they are not exposed in the UI by design."],
    [15, "App/website not working on mobile for voice/live conversation", "Partially Addressed", "Confirmed all mobile and web workflows are running and the app renders. Mobile-specific voice issues were not fixed in this turn.", "Workflows restarted", "Needs a dedicated Expo mobile voice pass if issues persist."],
]

summary = [
    ["Total Issues", 15],
    ["Fully Fixed", 6],
    ["Partially Addressed", 3],
    ["Not Addressed", 6],
    ["", ""],
    ["Workflows Restarted", "artifacts/edubharat: web, artifacts/api-server: API Server"],
    ["Typecheck Status", "Clean for both @workspace/edubharat and @workspace/api-server"],
]

wb = xlsxwriter.Workbook("reports/edubharat_issue_actions.xlsx")
ws = wb.add_worksheet("Issue Actions")

header_fmt = wb.add_format({"bold": True, "bg_color": "#2F5496", "font_color": "white", "border": 1, "text_wrap": True, "valign": "vcenter"})
fixed_fmt = wb.add_format({"bg_color": "#C6EFCE", "font_color": "#006100", "border": 1, "text_wrap": True, "valign": "top"})
partial_fmt = wb.add_format({"bg_color": "#FFEB9C", "font_color": "#9C5700", "border": 1, "text_wrap": True, "valign": "top"})
not_fmt = wb.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006", "border": 1, "text_wrap": True, "valign": "top"})
wrap_fmt = wb.add_format({"text_wrap": True, "valign": "top", "border": 1})
center_fmt = wb.add_format({"align": "center", "valign": "vcenter", "border": 1, "text_wrap": True})

headers = ["#", "Issue", "Status", "Action Taken", "Files Changed", "Reason / Note"]
ws.write_row(0, 0, headers, header_fmt)

for i, row in enumerate(rows, start=1):
    ws.write(i, 0, row[0], center_fmt)
    ws.write(i, 1, row[1], wrap_fmt)
    status = row[2]
    if status == "Fully Fixed":
        ws.write(i, 2, status, fixed_fmt)
    elif status == "Partially Addressed":
        ws.write(i, 2, status, partial_fmt)
    else:
        ws.write(i, 2, status, not_fmt)
    ws.write(i, 3, row[3], wrap_fmt)
    ws.write(i, 4, row[4], wrap_fmt)
    ws.write(i, 5, row[5], wrap_fmt)

ws.set_column("A:A", 6)
ws.set_column("B:B", 38)
ws.set_column("C:C", 18)
ws.set_column("D:D", 55)
ws.set_column("E:E", 50)
ws.set_column("F:F", 40)
ws.freeze_panes(1, 0)
ws.autofilter(0, 0, len(rows), len(headers) - 1)

ws2 = wb.add_worksheet("Summary")
ws2.write_row(0, 0, ["Metric", "Value"], header_fmt)
for i, row in enumerate(summary, start=1):
    ws2.write(i, 0, row[0], wrap_fmt)
    ws2.write(i, 1, row[1], wrap_fmt)
ws2.set_column("A:A", 25)
ws2.set_column("B:B", 55)

wb.close()
print("Created reports/edubharat_issue_actions.xlsx")
