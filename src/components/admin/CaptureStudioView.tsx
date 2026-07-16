import Link from "next/link";
import { ArrowRight, Boxes, FileUp, Film, ScanLine } from "lucide-react";

export function CaptureStudioView() {
  return (
    <div className="admin-capture-studio">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Type-to-Sign assets</p>
          <h1>Capture studio</h1>
          <p className="admin-dashboard-subtitle">
            Manage the gesture assets that support avatar animation, from source imports through landmark and pose-sequence preparation.
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <Link className="admin-action-button admin-action-button-primary" href="/admin/gesture-library/import"><FileUp size={16} aria-hidden="true" />Import assets</Link>
        </div>
      </header>

      <section className="admin-capture-studio-grid">
        <article className="admin-panel admin-studio-card">
          <span className="admin-studio-icon"><Film size={20} aria-hidden="true" /></span>
          <p className="admin-overline">Recording</p>
          <h2>Recording workspace unavailable</h2>
          <p>The capture route has not been implemented in this deployment, so no recording control is presented here.</p>
          <span className="admin-studio-status">Workspace not configured</span>
        </article>

        <article className="admin-panel admin-studio-card">
          <span className="admin-studio-icon"><FileUp size={20} aria-hidden="true" /></span>
          <p className="admin-overline">Available now</p>
          <h2>Import assets</h2>
          <p>Register video files and reference data from the existing gesture-library import workflow.</p>
          <Link className="admin-inline-link" href="/admin/gesture-library/import">Open import workspace <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className="admin-panel admin-studio-card">
          <span className="admin-studio-icon"><ScanLine size={20} aria-hidden="true" /></span>
          <p className="admin-overline">Sequence editing</p>
          <h2>Pose sequence editor</h2>
          <p>Manual landmark and pose-sequence editing remains planned until its dedicated workspace is available.</p>
          <span className="admin-studio-status">Not available yet</span>
        </article>
      </section>

      <section className="admin-panel admin-studio-workflow">
        <div className="admin-panel-heading"><div><p className="admin-overline">Asset flow</p><h2>Type-to-Sign preparation</h2></div><Boxes size={19} aria-hidden="true" /></div>
        <ol>
          <li><span>01</span><strong>Gesture source</strong><p>Import a gesture video or structured source asset.</p></li>
          <li><span>02</span><strong>Landmark extraction</strong><p>Derive MediaPipe landmarks for timing and movement analysis.</p></li>
          <li><span>03</span><strong>Pose sequence</strong><p>Normalize and sequence the motion for avatar playback.</p></li>
          <li><span>04</span><strong>Avatar animation</strong><p>Publish the prepared animation through the existing sign player.</p></li>
        </ol>
      </section>
    </div>
  );
}