import UploadForm from "./UploadForm";

export default function UploadPage() {
  return (
    <>
      <h1>Upload CVs</h1>
      <p className="muted small">Pick many files at once. Each batch is tagged with the role the candidates applied for.</p>
      <UploadForm />
      <p className="muted small">
        Before storing the CV, the app separates name, email and phone (kept in Supabase) from the CV content. Only the
        content, with contact lines and personal-detail lines removed, is ever sent to Gemini.
      </p>
    </>
  );
}
