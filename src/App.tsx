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
  
      let minDist = Infinity;
      let closest: Stop | null = null;
      for (const stop of stopsData) {
        const dist = getDistance(
          latitude,
          longitude,
          parseFloat(stop.lat),
          parseFloat(stop.lng)
        );
        if (dist < minDist) {
          minDist = dist;
          closest = stop;
        }
      }
  
      if (closest) {
        setParadaId(closest.id);
        setGeoStatus(
          `Parada más cercana: ${closest.calle} (ID: ${closest.id}) a ${minDist.toFixed(2)} km.`
        );
      } else {
        setGeoStatus("No se encontraron paradas cercanas.");
      }
    } catch (error) {
      setGeoStatus("No se pudo obtener la ubicación.");
      console.error(error);
    }
  }

  return (
    <main className="flex flex-col min-h-screen p-4 bg-background text-foreground font-sans">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold">🚌 Ahi Viene Web</h1>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            type="number"
            value={paradaId}
            onChange={(e) => setParadaId(e.target.value)}
            placeholder="ID de la parada"
            className="flex-1"
          />
          <Button onClick={handleBuscar}>Buscar</Button>
          <Button onClick={handleGeo} variant="secondary">📍</Button>
        </div>

        {geoStatus && (
          <div className="text-sm text-muted-foreground">{geoStatus}</div>
        )}

      <Card className="flex-1 overflow-auto min-h-[200px]">
        <CardContent className="pt-4 space-y-4">
          {typeof resultado === "string" ? (
            <p className="text-sm whitespace-pre-wrap">{resultado}</p>
          ) : (
            resultado.map((mob, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 shadow-sm bg-muted text-muted-foreground"
              >
                <p className="font-semibold text-base">🚌 Colectivo {index + 1}</p>
                <p>Ruta: <span className="text-foreground">{mob.hacia}</span></p>
                <p>Llega en: <span className="text-foreground">{mob.t}</span></p>
                <p>Distancia: <span className="text-foreground">{mob.dist.toFixed(2)} km</span></p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      </section>

      <footer className="mt-auto pt-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Ahi Viene Web
      </footer>
    </main>
  );
}
