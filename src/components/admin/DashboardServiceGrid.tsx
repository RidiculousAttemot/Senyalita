import type { ServiceStatus } from "@/lib/admin/dashboard";

export type DashboardService = ServiceStatus & {
  name: string;
};

export function DashboardServiceGrid({ services }: { services: DashboardService[] }) {
  return (
    <div className="admin-service-grid" aria-label="Realtime system status">
      {services.map((service) => (
        <article key={service.name} className="admin-service-card">
          <div className="admin-service-card-head">
            <h3>{service.name}</h3>
            <span className={`admin-status admin-status-${service.tone}`}>
              <span aria-hidden="true" className="admin-status-dot" />
              {service.label}
            </span>
          </div>
          <p>{service.detail}</p>
        </article>
      ))}
    </div>
  );
}