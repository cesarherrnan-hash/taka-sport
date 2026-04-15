import { processFeeds } from './services/rssService';
import { processClusters } from './services/clusteringService';

async function main() {
    console.log("🚀 Motor Taka Sport iniciado...");
    
    try {
        // PASO 1: Descargar noticias de las fuentes (ESPN, etc.)
        console.log("1️⃣ Iniciando descarga de noticias...");
        await processFeeds();
        
        // PASO 2: Agrupar noticias similares y enviarte la alerta a Telegram
        console.log("2️⃣ Iniciando agrupación y alertas...");
        await processClusters();
        
        console.log("🏁 Ciclo completo terminado con éxito.");
    } catch (error) {
        console.error("❌ Ocurrió un error en el motor principal:", error);
    }
}

// Ejecutamos el programa
main();