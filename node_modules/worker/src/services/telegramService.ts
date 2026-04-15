import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/supabase';
import { draftArticle } from './aiService';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');
const chatId = process.env.TELEGRAM_CHAT_ID || '';

export async function sendApprovalRequest(clusterId: string, topicName: string, sourcesCount: number) {
    if (!chatId) return;
    const cleanTopic = topicName.replace(/[*_`]/g, '');
    const message = `🚨 NOTICIA DETECTADA\n\n📝 TEMA: ${cleanTopic}\n📊 FUENTES: ${sourcesCount}\n\n¿Redactamos?`;
    
    try {
        await bot.telegram.sendMessage(chatId, message, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Redactar ahora', `approve_${clusterId}`),
             Markup.button.callback('❌ Descartar', `reject_${clusterId}`)]
        ]));
    } catch (e: any) { console.error("Error envío Telegram:", e.message); }
}

bot.action(/approve_(.+)/, async (ctx) => {
    const clusterId = ctx.match[1];
    await ctx.answerCbQuery("Iniciando redacción...");
    await ctx.editMessageText("⏳ IA trabajando... redactando noticia para Taka Sport.");

    try {
        // 1. Obtener los artículos del clúster
        const { data: relations, error: dbError } = await supabase
            .from('cluster_articles')
            .select('raw_articles (title, summary)')
            .eq('cluster_id', clusterId);

        if (dbError || !relations || relations.length === 0) {
            console.error("Error DB:", dbError);
            return ctx.reply("❌ Error: No encontré la noticia en la base de datos.");
        }

        // Extraemos el texto de forma segura
        const context = relations
            .map((r: any) => r.raw_articles.summary)
            .filter(s => s !== null)
            .join("\n\n");
        
        const topic = (relations[0] as any).raw_articles.title;

        console.log(`🤖 Pidiendo redacción a Gemini para: ${topic}`);

        // 2. Llamar a la IA
        const draft = await draftArticle(topic, context);

        // 3. Enviar resultado
        await ctx.reply(`✍️ *BORRADOR SUGERIDO:*\n\n${draft}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🚀 Publicar en Web', `publish_${clusterId}`)]
            ])
        });

    } catch (e: any) {
        console.error("❌ ERROR CRÍTICO EN REDACCIÓN:", e); 
        await ctx.reply("❌ Error al redactar: El modelo de IA no respondió correctamente.");
    }
});

// OÍDO DEL BOT: Acción de publicar en la Web
bot.action(/publish_(.+)/, async (ctx) => {
    const clusterId = ctx.match[1];
    
    const fullText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
        ? ctx.callbackQuery.message.text 
        : "";

    await ctx.answerCbQuery("Publicando...");
    
    try {
        // EXTRAEMOS LOS DATOS BASADOS EN EL NUEVO PROMPT ESTRICTO DE LA IA
        const categoryLine = fullText.split('\n').find(l => l.includes('CATEGORIA:')) || "";
        const category = categoryLine.replace('CATEGORIA:', '').trim() || 'Polideportivo'; // Valor por defecto si falla

        const titleLine = fullText.split('\n').find(l => l.includes('TITULO:')) || "";
        const title = titleLine.replace('TITULO:', '').trim();
        
        // Manejamos la compatibilidad por si Gemini usa SEO_DESCRIPTION o BAJADA
        const bajadaLine = fullText.split('\n').find(l => l.includes('SEO_DESCRIPTION:') || l.includes('BAJADA:')) || "";
        const bajada = bajadaLine.replace(/SEO_DESCRIPTION:|BAJADA:/, '').trim();

        // Creamos un slug (URL amigable)
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Guardamos en la tabla de borradores editoriales
        const { error } = await supabase
            .from('editorial_drafts')
            .insert([{
                cluster_id: clusterId,
                title: title,
                category: category, // <--- LA NUEVA CATEGORIA SE GUARDA AQUI
                slug: slug,
                content: fullText, 
                seo_description: bajada,
                status: 'published',
                published_at: new Date().toISOString()
            }]);

        if (error) throw error;

        await ctx.editMessageText(`✅ ¡PUBLICADO EXITOSAMENTE!\n\nCategoría: ${category}\nLa noticia "${title}" ya está en la base de datos de la web.`);

    } catch (e: any) {
        console.error("Error al publicar:", e);
        await ctx.reply(`❌ Error al publicar: ${e.message}`);
    }
});

bot.launch().then(() => console.log("🤖 Bot de Taka Sport Activo y Escuchando..."));