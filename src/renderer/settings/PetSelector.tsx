import type { PetRegistrySnapshot } from "../../core/pet/pet-manifest";

export interface PetSelectorProps {
  pets: PetRegistrySnapshot;
  pending?: string;
  onSelect(id: string): void;
  onImport(): void;
  onOpenDirectory(): void;
  onRescan(): void;
}

export function PetSelector({
  pets,
  pending,
  onSelect,
  onImport,
  onOpenDirectory,
  onRescan,
}: PetSelectorProps) {
  const active = pets.active;
  return (
    <div className="pet-selector">
      {active ? (
        <article className="current-pet" data-testid="current-pet" data-pet-id={active.manifest.id}>
          <div className="pet-preview-frame">
            <img src={active.previewUrl} alt={`${active.manifest.name} preview`} />
          </div>
          <div className="current-pet-copy">
            <p className="eyebrow">Current pet</p>
            <h3>{active.manifest.name}</h3>
            <dl className="pet-metadata">
              <div>
                <dt>Version</dt>
                <dd>v{active.manifest.version}</dd>
              </div>
              <div>
                <dt>Author</dt>
                <dd>{active.manifest.author}</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>{active.manifest.license}</dd>
              </div>
            </dl>
          </div>
        </article>
      ) : (
        <p className="pet-empty">No valid pet package is available. Import a package or rescan.</p>
      )}

      <div className="pet-actions" aria-label="Pet package actions">
        <button
          type="button"
          data-testid="pet-import"
          disabled={Boolean(pending)}
          onClick={onImport}
        >
          {pending === "import" ? "Importing..." : "Import package"}
        </button>
        <button type="button" disabled={Boolean(pending)} onClick={onOpenDirectory}>
          Open directory
        </button>
        <button
          type="button"
          data-testid="pet-rescan"
          disabled={Boolean(pending)}
          onClick={onRescan}
        >
          {pending === "rescan" ? "Scanning..." : "Rescan"}
        </button>
      </div>

      <div className="pet-list-heading">
        <strong>Installed pets</strong>
        <small>{pets.available.length} valid package(s)</small>
      </div>
      <div className="pet-card-grid">
        {pets.available.map((pet) => (
          <article
            className={`pet-card ${pet.active ? "pet-card--active" : ""}`}
            data-testid="pet-card"
            data-pet-id={pet.id}
            key={pet.id}
          >
            <img src={pet.previewUrl} alt="" aria-hidden="true" />
            <div>
              <strong>{pet.name}</strong>
              <small>
                v{pet.version} · {pet.origin}
              </small>
            </div>
            <span className="pet-card-status">{pet.active ? "Active" : "Available"}</span>
            <button
              type="button"
              data-testid={`pet-select-${pet.id}`}
              disabled={pet.active || Boolean(pending)}
              onClick={() => onSelect(pet.id)}
            >
              {pending === `select:${pet.id}` ? "Switching..." : pet.active ? "Selected" : "Switch"}
            </button>
          </article>
        ))}
      </div>

      {pets.issues.length > 0 && (
        <details className="pet-issues">
          <summary>{pets.issues.length} package issue(s) ignored</summary>
          <ul>
            {pets.issues.map((issue, index) => (
              <li key={`${issue.packageName}-${index}`}>
                <strong>{issue.packageName}:</strong> {issue.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
