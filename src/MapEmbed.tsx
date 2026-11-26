import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Phone, X } from "lucide-react";
import MapView from "./MapView";
import { places, vkLinkFor } from "./data";
import { useTheme } from "./useTheme";

const STYLE = "\n.map-embed{position:fixed;inset:0;width:100%;height:100dvh;overflow:hidden;background:var(--page-bg);color:var(--ink)}\n.map-embed .map-shell,.map-embed .map-canvas{width:100%;height:100%;min-height:0;border-radius:0}\n.map-embed .map-tools button{width:48px;height:48px}\n.map-embed .map-provider-fallback{position:absolute;top:72px;bottom:auto;left:16px;max-width:calc(100% - 90px);z-index:1100}\n.embed-place{position:absolute;left:16px;bottom:58px;width:350px;max-width:calc(100% - 32px);max-height:calc(100% - 128px);overflow:auto;z-index:1200;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 6px 28px #1f143a30}\n.embed-place-header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 8px 8px 16px;background:var(--surface);z-index:1}\n.embed-place-header h2{font-size:23px;line-height:1.3;margin:0}\n.embed-place-header button{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px}\n.embed-place-body{padding:0 16px 14px;font-size:14px;line-height:1.6}\n.embed-place-body p{display:flex;align-items:flex-start;gap:8px;margin:5px 0}\n.embed-place-body p svg{flex-shrink:0;margin-top:4px}\n.embed-contact{display:flex;align-items:center;gap:8px;min-height:44px;color:var(--purple);text-decoration:none}\n";

export default function MapEmbed() {
  const { theme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.search).get("place");
    return places.some(place => place.id === id) ? id : null;
  });
  const selected = places.find(place => place.id === selectedId);
  useEffect(() => {
    const previous = document.title;
    document.title = "Клубы района — карта";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="map-embed" aria-label="Карта клубов Московского района">
      <style>{STYLE}</style>
      <MapView places={places} selected={selectedId} onSelect={setSelectedId} theme={theme} />
      {selected && (
        <section className="embed-place" aria-label={"Карточка клуба: " + selected.name}>
          <header className="embed-place-header">
            <h2>{selected.name}</h2>
            <button onClick={() => setSelectedId(null)} aria-label="Закрыть карточку клуба"><X size={21}/></button>
          </header>
          <div className="embed-place-body">
            <p><MapPin size={17}/><span>{selected.address}</span></p>
            {selected.phone && <a className="embed-contact" href={"tel:" + selected.phone.replace(/[^+0-9]/g,"")}><Phone size={17}/>{selected.phone}</a>}
            <a className="embed-contact" href={vkLinkFor(selected).url} target="_blank" rel="noreferrer">Группа клуба ВКонтакте <ExternalLink size={15}/></a>
          </div>
        </section>
      )}
    </main>
  );
}
