import Parser from 'rss-parser';
import { supabase } from '../config/supabase';

// ¡NUEVO!: Le configuramos un "User-Agent" para que los medios crean que somos un navegador real
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

export async function processFeeds() {
    const { data: sources } = await supabase.from('sources').select('*').eq('is_active', true);

    if (!sources || sources.length === 0) {
        console.log("⚠️ No hay fuentes activas en la base de datos.");
        return;
    }

    for (const source of sources) {
        try {
            console.log(`📥 Leyendo: ${source.name}...`);
            const feed = await parser.parseURL(source.rss_url);

            const articles = feed.items.map(item => ({
                source_id: source.id,
                guid: item.guid || item.link,
                title: item.title,
                url: item.link,
                summary: item.contentSnippet || item.content,
                pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
            }));

            const { error } = await supabase
                .from('raw_articles')
                .upsert(articles, { onConflict: 'guid' });

            if (error) console.error(`❌ Error al guardar en base de datos:`, error.message);
            else console.log(`✅ ${articles.length} noticias guardadas de ${source.name}`);

        } catch (err: any) {
            // ¡NUEVO!: Ahora imprimimos el mensaje exacto del error
            console.error(`❌ Error descargando ${source.name}: ${err.message}`);
        }
    }
}