// Shown when a form link is wrong, or the form is unpublished. No Scalency branding.
export default function FormNotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f8fb", fontFamily: "system-ui, sans-serif", color: "#0b1b3a" }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>This form isn&apos;t available</h1>
        <p style={{ margin: 0, color: "#5b6b85", fontSize: 15, lineHeight: 1.5 }}>The link may be wrong, or the form has been switched off. Please check with whoever sent it to you.</p>
      </div>
    </main>
  );
}
