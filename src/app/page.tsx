import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <h1>SignLangVisual</h1>
        <p>
          This web app captures hand signs through your webcam and displays
          translated text in real time.
        </p>
        <p>Click Start to open the camera and begin live translation.</p>
        <Link className="button" href="/camera">
          Start
        </Link>
      </section>
    </main>
  );
}
