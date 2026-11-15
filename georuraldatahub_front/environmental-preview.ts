import {createApp,h,ref} from 'vue'
import {VApp,VBtn} from 'vuetify/components'
import vuetify from './src/plugins/vuetify'
import './src/assets/glassmorphism.css'
import Indicators from './src/components/workspace/WorkspaceIndicators.vue'
import Layers from './src/components/workspace/WorkspaceLayers.vue'
import axios from 'axios'
import {setSessionUser} from './src/access/session'
setSessionUser({id:1,name:'Teste isolado',userType:'OPERADOR',userStatus:1})
const layers=[{id:1,name:'Municípios do Paraná',datasetId:10,dataset:'Dados de teste',versionId:2,file:'municipios.geojson',source:'IBGE (teste)',geometry:'MULTIPOLYGON',features:399,polygons:399,srid:4326,composed:false},{id:2,name:'Vegetação nativa',datasetId:10,dataset:'Dados de teste',versionId:3,file:'vegetacao.geojson',source:'Fonte de teste',geometry:'POLYGON',features:28,polygons:28,srid:4326,composed:false}]
axios.defaults.adapter=async config=>{
 const url=config.url ?? '';let data:unknown
 const polygon=(coords:number[][],papel:string)=>({type:'Feature',properties:{papel},geometry:{type:'Polygon',coordinates:[coords]}})
 if(url.endsWith('/mapa'))data={type:'FeatureCollection',aviso:'Prévia com geometrias fictícias. Nenhuma chamada ao Oracle.',features:[polygon([[-49.4,-25.5],[-49.2,-25.5],[-49.2,-25.3],[-49.4,-25.3],[-49.4,-25.5]],'analise'),polygon([[-49.4,-25.5],[-49.3,-25.5],[-49.3,-25.4],[-49.4,-25.4],[-49.4,-25.5]],'ICV')]}
 else if(url.includes('/indicadores/'))data={ICV:{areaHa:25,percentual:25},areaImovelHa:100,imovelId:928,regra:'TESTE-1',projecaoCalculo:'Albers (teste)',calculadoEm:'2026-11-15T15:00:00Z',fontes:[{camadaId:2,nome:'Vegetação nativa',arquivo:'vegetacao.geojson',fonte:'Fonte de teste',versaoId:3}]}
 else if(url.includes('/camada-oracle'))data={camadaId:2,quantidade:28}
 else if(url.endsWith('/versoes-importaveis'))data={items:[{id:2,number:1,fileId:3,file:'vegetacao.geojson',source:'Fonte de teste',format:'GeoJSON',importedLayers:0}],total:1,page:0,size:20}
 else if(url.endsWith('/feicoes'))data={items:[{id:928,name:'Curitiba (teste)',attributes:'{"NM_MUN":"Curitiba (teste)"}'}],total:1,page:0,size:20}
 else if(url==='/ambiental/camadas')data={items:layers,total:2,page:0,size:20}
 else if(url.startsWith('/ambiental/camadas/'))data={layer:layers.find(l=>l.id===Number(url.split('/').pop())),origins:[]}
 else if(url==='/ambiental/recursos')data={compositionEnabled:false}
 else if(url==='/conjuntos')data=[{id:10,name:'Dados de teste'}]
 else throw Error('Rota não simulada: '+url)
 return {data,status:200,statusText:'OK',headers:{},config}
}
createApp({setup(){const tab=ref('meters');return ()=>h(VApp,{},()=>h('main',{style:'height:100dvh;display:flex;flex-direction:column;padding:24px;gap:16px;background:#0b0a0f'},[h('div',{style:'display:flex;gap:12px;align-items:center'},[h('strong','PRÉVIA ISOLADA'),h(VBtn,{onClick:()=>tab.value='meters'},()=> 'Medidores'),h(VBtn,{onClick:()=>tab.value='layers'},()=> 'Camadas')]),tab.value==='meters'?h(Indicators,{onManageLayers:()=>tab.value='layers'}):h(Layers,{initialDataset:10})]))}}).use(vuetify).mount('#app')
