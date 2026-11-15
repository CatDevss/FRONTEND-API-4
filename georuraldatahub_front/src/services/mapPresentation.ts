import L from 'leaflet'

export function paranaBounds() {
  return L.latLngBounds([-26.72, -54.62], [-22.5, -48.02])
}
/** Configuração de mapa compartilhada pela área de trabalho e pelos indicadores. */
export function addMapPresentation(map: L.Map) {
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    className: 'map-tiles-dark',
  })
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    },
  )
  streets.addTo(map)
  const layers = L.control.layers({ 'Ruas (escuro)': streets, Satélite: satellite }, undefined, {
    position: 'bottomright',
  })
  layers.addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  L.control.scale({ imperial: false }).addTo(map)
  return layers
}
