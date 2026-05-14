# EECE 503Q Exam Prep Web App

A static exam-prep web app for EECE 503Q. It includes the main multiple-choice question bank, the added final exam PDFs as exact MCQ practice sets, and a subjective questions section with model answers.

## What's Included

- `index.html` - course selector landing page.
- `EECE 503Q Exam.html` - EECE 503Q interactive exam prep app.
- `questions-data.js` - original EECE 503Q MCQ question bank.
- `added-exams-data.js` - added MCQs and subjective model answers from:
  - `Final_Exam_Comprehensive.pdf`
  - `Final_Exam_v2.pdf`
- `exam.jsx` - shared React quiz interface.
- `source/` - source PDFs and extracted text used to build the question bank.
- `uploads/` - uploaded exam material.

## Run Locally

This is a static site. No package installation is required.

From this folder, run:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

Direct EECE 503Q page:

```text
http://127.0.0.1:5173/EECE%20503Q%20Exam.html
```

## Notes

- Progress is stored locally in the browser.
- The app loads React and Babel from CDN links, so an internet connection is needed for first load unless those scripts are cached.
- The added final exams appear as separate cards under "Added exams".
- Subjective questions and model answers are available from the "Subjective answers" button.
