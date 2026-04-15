import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

// Inicializamos la API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// USAMOS EL MODELO QUE TE APARECE EN TU PANEL
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export async function draftArticle(topic: string, context: string) {
    const prompt = `
        Eres un periodista deportivo de élite de Taka Sport. 
        Redacta una noticia sobre este tema: ${topic}
        Usa este contexto: ${context}
        
        REGLAS ESTRICTAS DE FORMATO:
        Tu respuesta debe contener EXACTAMENTE la siguiente estructura, sin agregar nada más al principio ni al final:
        
        CATEGORIA: [Elegir estrictamente una: Fútbol, Tenis, Baloncesto, F1, MotoGP, Polideportivo]
        TITULO: [Título impactante y profesional]
        SEO_DESCRIPTION: [Resumen de máximo 150 caracteres para la bajada]
        CUERPO: [Contenido completo de la noticia, emocionante y profesional. No uses asteriscos ni símbolos extraños]
    `;

    try {
        console.log("📡 Conectando con Gemini 3 Flash...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Limpiamos el texto para Telegram
        return text.replace(/\*/g, '').replace(/#/g, ''); 
    } catch (error: any) {
        console.error("❌ Error en Gemini 3:", error.message);
        
        // Plan B con el otro modelo de tu lista
        try {
            console.log("🔄 Intentando con Plan B (gemini-pro-latest)...");
            const backupModel = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
            const result = await backupModel.generateContent(prompt);
            return result.response.text().replace(/\*/g, '');
        } catch (innerError: any) {
            throw new Error(`Error en Google AI: ${innerError.message}`);
        }
    }
}