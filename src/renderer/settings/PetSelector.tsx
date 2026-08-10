import type { CSSProperties } from "react";
import type { PetAnimationAsset, PetRegistrySnapshot } from "../../core/pet/pet-manifest";
import type { CodexPokePetsDiscoverySnapshot } from "../../core/pet/adapters/codex-pokepets-types";
import { petOriginLabel } from "./settings-copy";

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
              name={`${active.manifest.name} 预览`}
              size={128}
            />
          </div>
          <div className="current-pet-copy">
            <p className="eyebrow">当前宠物</p>
            <h3>{active.manifest.name}</h3>
            <dl className="pet-metadata">
              <div>
                <dt>版本</dt>
                <dd>v{active.manifest.version}</dd>
              </div>
              <div>
                <dt>作者</dt>
                <dd>{active.manifest.author}</dd>
              </div>
              <div>
                <dt>许可证</dt>
                <dd>{active.manifest.license}</dd>
              </div>
            </dl>
          </div>
        </article>
      ) : (
        <p className="pet-empty">暂无可用的有效宠物包，请导入宠物包或重新扫描。</p>
      )}

      <div className="pet-actions" aria-label="宠物包操作">
        <button
          type="button"
          data-testid="pet-import"
          disabled={Boolean(pending)}
          onClick={onImport}
        >
          {pending === "import" ? "正在导入…" : "导入宠物包"}
        </button>
        <button
          type="button"
          data-testid="codex-pokepet-import"
          disabled={Boolean(pending)}
          onClick={onImportCodexPokePet}
        >
          {pending === "import-codex" ? "正在导入…" : "导入 Codex PokéPet"}
        </button>
        <button type="button" disabled={Boolean(pending)} onClick={onOpenDirectory}>
          打开宠物素材目录
        </button>
        <button
          type="button"
          data-testid="pet-rescan"
          disabled={Boolean(pending)}
          onClick={onRescan}
        >
          {pending === "rescan" ? "正在扫描…" : "重新扫描"}
        </button>
      </div>

      <div className="pet-list-heading">
        <strong>已安装的宠物</strong>
        <small>{pets.available.length} 个有效宠物包</small>
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
              name={`${pet.name} 预览`}
              size={54}
            />
            <div>
              <strong>{pet.name}</strong>
              <small>
                v{pet.version} · {petOriginLabel(pet.origin)}
              </small>
            </div>
            <span className="pet-card-status">{pet.active ? "使用中" : "可用"}</span>
            <button
              type="button"
              data-testid={`pet-select-${pet.id}`}
              disabled={pet.active || Boolean(pending)}
              onClick={() => onSelect(pet.id)}
            >
              {pending === `select:${pet.id}` ? "正在切换…" : pet.active ? "已选择" : "切换"}
            </button>
          </article>
        ))}
      </div>

      <section className="codex-pokepets-discovery" aria-labelledby="codex-pokepets-heading">
        <div className="pet-list-heading">
          <div>
            <strong id="codex-pokepets-heading">已安装的 Codex PokéPets</strong>
            <small className="third-party-badge">第三方本地来源</small>
          </div>
          <button type="button" disabled={Boolean(pending)} onClick={onScanCodexPokePets}>
            {pending === "scan-codex" ? "正在扫描…" : "扫描已安装的 Codex PokéPets"}
          </button>
        </div>
        <p className="third-party-notice">
          第三方角色素材仍受其原有权利约束，不受本应用 MIT 许可证覆盖。扫描仅在本地进行，
          不会自动导入任何素材。
        </p>
        {!codexPokePets.rootAvailable ? (
          <p className="pet-empty">本地 Codex 宠物目录不可用。</p>
        ) : codexPokePets.pets.length === 0 ? (
          <p className="pet-empty">未找到已安装的本地 Codex PokéPets。</p>
        ) : (
          <div className="codex-source-list">
            {codexPokePets.pets.map((pet) => (
              <article className="codex-source-card" key={pet.sourcePetId}>
                <div>
                  <strong>{pet.displayName}</strong>
                  <small>本地 ID：{pet.sourcePetId}</small>
                </div>
                <span className="third-party-badge">第三方</span>
                <span>{pet.imported ? "已导入" : pet.compatible ? "兼容" : "不兼容"}</span>
                <button
                  type="button"
                  disabled={pet.imported || !pet.compatible || Boolean(pending)}
                  onClick={() => onImportDiscovered(pet.sourcePetId)}
                >
                  {pending === `import-codex:${pet.sourcePetId}` ? "正在导入…" : "导入"}
                </button>
                {pet.error && <p>{pet.error}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {pets.issues.length > 0 && (
        <details className="pet-issues">
          <summary>已忽略 {pets.issues.length} 个宠物包问题</summary>
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
