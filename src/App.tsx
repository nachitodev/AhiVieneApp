import { useEffect, useState } from "react";
import { Geolocation } from '@capacitor/geolocation';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Stop = {
  id: string;
  calle: string;
  lat: string;
  lng: string;
};

type Mob = {
  hacia: string;
  t: string;
  dist: number;
  parada?: string;
  paradaDist?: number;
};

export default function App() {
  const [paradaId, setParadaId] = useState("");
  const [geoStatus, setGeoStatus] = useState("");
  const [resultado, setResultado] = useState<Mob[] | string>("");
  const [stopsData, setStopsData] = useState<Stop[] | null>(null);

  useEffect(() => {
    fetch("/stops.json")
      .then((res) => res.json())
      .then((data) => setStopsData(data.stops))
      .catch(() => setGeoStatus("No se pudo cargar stops.json"));
  }, []);

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function getColectivo(idParada: string): Promise<Mob[] | string> {
    try {
      const url = `https://corsproxy.io/?url=http://ahiviene.com.ar/rest/mobs/${idParada}/${Date.now()}`;
      const res = await fetch(url);
      const json = await res.json();
      const mobs: Mob[] = json.mobs;
      if (!mobs || mobs.length === 0) return "😥 | No hay colectivos disponibles.";
      return mobs.sort((a, b) => a.dist - b.dist);
    } catch {
      return "❌ | Error al obtener los datos.";
    }
  }

  async function handleBuscar() {
    if (!paradaId) {
      setResultado("Por favor, ingresa un ID de parada.");
      return;
    }
    setResultado("Buscando...");
    const res = await getColectivo(paradaId);
    setResultado(res);
  }

  async function handleGeo() {
    setGeoStatus("Obteniendo ubicación...");

    if (!stopsData) {
      setGeoStatus("Paradas no cargadas aún.");
      return;
    }

    try {
      await Geolocation.requestPermissions();
      const pos = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = pos.coords;

      const distancias = stopsData.map((stop) => {
        const dist = getDistance(
          latitude,
          longitude,
          parseFloat(stop.lat),
          parseFloat(stop.lng)
        );
        return { ...stop, dist };
      });

      const tresMasCercanas = distancias
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      const paradasText = tresMasCercanas
        .map((p) => `${p.calle} (ID: ${p.id}) a ${p.dist.toFixed(2)} km`)
        .join(" | ");

      setGeoStatus(`Paradas más cercanas: ${paradasText}`);

      const todasLasPromesas = await Promise.all(
        tresMasCercanas.map(async (stop) => {
          const res = await getColectivo(stop.id);
          if (typeof res === "string") {
            return [{
              hacia: res,
              t: "",
              dist: 0,
              parada: `${stop.calle} (ID: ${stop.id})`,
              paradaDist: stop.dist,
            }];
          } else {
            return res.map((mob) => ({
              ...mob,
              parada: `${stop.calle} (ID: ${stop.id})`,
              paradaDist: stop.dist,
            }));
          }
        })
      );

      const resultadoPlano = todasLasPromesas.flat();
      setResultado(resultadoPlano);
    } catch (error) {
      setGeoStatus("No se pudo obtener la ubicación.");
      console.error(error);
    }
  }

  return (
    <main className="flex flex-col min-h-screen p-4 bg-zinc-900 text-zinc-100 font-sans">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold">🚌 Ahi Viene Web</h1>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex gap-2 items-center">
          <select
            value={paradaId}
            onChange={(e) => setParadaId(e.target.value)}
            className="flex-1 bg-zinc-800 text-zinc-100 border-zinc-700 rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">Selecciona una parada</option>
            {stopsData && stopsData.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.calle} (ID: {stop.id})
              </option>
            ))}
          </select>
          <Input
            type="number"
            value={paradaId}
            onChange={(e) => setParadaId(e.target.value)}
            placeholder="ID de la parada"
            className="flex-1 bg-zinc-800 text-zinc-100 placeholder-zinc-400 border-zinc-700"
          />
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBuscar}>
            Buscar
          </Button>
          <Button
            onClick={handleGeo}
            className="bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            📍
          </Button>
        </div>

        {geoStatus && (
          <div className="text-sm text-zinc-400">{geoStatus}</div>
        )}

        <Card className="flex-1 overflow-auto min-h-[200px] bg-zinc-800 text-zinc-100 border-zinc-700">
          <CardContent className="pt-4 space-y-4">
            {typeof resultado === "string" ? (
              <p className="text-sm whitespace-pre-wrap">{resultado}</p>
            ) : (
              resultado.map((mob, index) => (
                <div
                  key={index}
                  className="border border-zinc-700 rounded-lg p-3 shadow-sm bg-zinc-700 text-zinc-200"
                >
                  <p className="font-semibold text-base">🚌 Colectivo {index + 1}</p>
                  {mob.parada && (
                    <p className="text-sm text-zinc-300 mb-1">
                      Parada: <span className="text-white">{mob.parada}</span>
                    </p>
                  )}
                  <p>
                    Ruta: <span className="text-white">{mob.hacia}</span>
                  </p>
                  <p>
                    Llega en: <span className="text-white">{mob.t || "-"}</span>
                  </p>
                  <p>
                    Distancia: <span className="text-white">{mob.dist.toFixed(2)} km</span>
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="mt-auto pt-6 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} Ahi Viene Web
      </footer>
    </main>
  );
}
