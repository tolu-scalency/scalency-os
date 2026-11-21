export default function PageNotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#334155", padding: 24, textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>This page isn&apos;t available</h1>
        <p style={{ margin: 0 }}>It may have been unpublished or moved.</p>
      </div>
    </main>
  );
}
