import type { CSSProperties } from "react";
import type { PetAnimationAsset, PetRegistrySnapshot } from "../../core/pet/pet-manifest";
import type { CodexPokePetsDiscoverySnapshot } from "../../core/pet/adapters/codex-pokepets-types";

export interface PetSelectorProps {
  pets: PetRegistrySnapshot;
  codexPokePets: CodexPokePetsDiscoverySnapshot;
  pending?: string;
  onSelect(id: string): void;
  onImport(): void;
  onImportCodexPokePet(): void;
  onScanCodexPokePets(): void;
  onImportDiscovered(sourcePetId: string): void;
  onOpenDirectory(): void;
  onRescan(): void;
}

function PetPreview({
  url,
  animation,
  name,
  size,
}: {
  url: string;
  animation?: PetAnimationAsset;
  name: string;
  size: number;
}) {
  if (!animation || animation.format !== "webp") return <img src={url} alt={name} />;
  const scale = Math.min(size / animation.frameWidth, size / animation.frameHeight);
  const style = {
    width: `${animation.frameWidth}px`,
    height: `${animation.frameHeight}px`,
    backgroundImage: `url("${animation.spriteUrl}")`,
    backgroundSize: `${animation.sheetWidth}px ${animation.sheetHeight}px`,
    backgroundPosition: `0 ${-(animation.frameRow ?? 0) * animation.frameHeight}px`,
    transform: `scale(${scale})`,
  } as CSSProperties;
  return (
    <span
      className="pet-atlas-preview"
      role="img"
      aria-label={name}
      style={{ width: size, height: size }}
    >
      <span style={style} />
    </span>
  );
}

export function PetSelector({
  pets,
  codexPokePets,
  pending,
  onSelect,
  onImport,
  onImportCodexPokePet,
  onScanCodexPokePets,
  onImportDiscovered,
  onOpenDirectory,
  onRescan,
}: PetSelectorProps) {
  const active = pets.active;
  return (
    <div className="pet-selector">
      {active ? (
        <article className="current-pet" data-testid="current-pet" data-pet-id={active.manifest.id}>
          <div className="pet-preview-frame">
            <PetPreview
              url={active.previewUrl}
              animation={active.animations.idle}
              name={`${active.manifest.name} preview`}
              size={128}
            />
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
          {pending === "import" ? "Importing..." : "Import Pet Package"}
        </button>
        <button type="button" disabled={Boolean(pending)} onClick={onImportCodexPokePet}>
          {pending === "import-codex" ? "Importing..." : "Import Codex PokéPet"}
        </button>
        <button type="button" disabled={Boolean(pending)} onClick={onOpenDirectory}>
          Open managed pet directory
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
            <PetPreview
              url={pet.previewUrl}
              animation={pet.previewAnimation}
              name={`${pet.name} preview`}
              size={54}
            />
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

      <section className="codex-pokepets-discovery" aria-labelledby="codex-pokepets-heading">
        <div className="pet-list-heading">
          <div>
            <strong id="codex-pokepets-heading">Installed Codex PokéPets</strong>
            <small className="third-party-badge">Third-party local source</small>
          </div>
          <button type="button" disabled={Boolean(pending)} onClick={onScanCodexPokePets}>
            {pending === "scan-codex" ? "Scanning..." : "Scan installed Codex PokéPets"}
          </button>
        </div>
        <p className="third-party-notice">
          Third-party character assets remain subject to their original rights and are not covered
          by this application's MIT license. Scanning is local-only and never imports automatically.
        </p>
        {!codexPokePets.rootAvailable ? (
          <p className="pet-empty">The local Codex pets directory is not available.</p>
        ) : codexPokePets.pets.length === 0 ? (
          <p className="pet-empty">No installed local Codex PokéPets were found.</p>
        ) : (
          <div className="codex-source-list">
            {codexPokePets.pets.map((pet) => (
              <article className="codex-source-card" key={pet.sourcePetId}>
                <div>
                  <strong>{pet.displayName}</strong>
                  <small>Local ID: {pet.sourcePetId}</small>
                </div>
                <span className="third-party-badge">Third-party</span>
                <span>
                  {pet.imported ? "Imported" : pet.compatible ? "Compatible" : "Incompatible"}
                </span>
                <button
                  type="button"
                  disabled={pet.imported || !pet.compatible || Boolean(pending)}
                  onClick={() => onImportDiscovered(pet.sourcePetId)}
                >
                  {pending === `import-codex:${pet.sourcePetId}` ? "Importing..." : "Import"}
                </button>
                {pet.error && <p>{pet.error}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

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
