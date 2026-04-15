import stringSimilarity from 'string-similarity';
import { supabase } from '../config/supabase';
import { sendApprovalRequest } from './telegramService'; // <--- ¡REVISA QUE ESTA LÍNEA ESTÉ!

const SIMILARITY_THRESHOLD = 0.5; // Si se parecen más del 50%, van juntos

export async function processClusters() {
    console.log("🧠 Iniciando agrupación de noticias...");

    // 1. Traer noticias que no tengan grupo aún
    const { data: articles } = await supabase
        .from('raw_articles')
        .select('*');

    if (!articles || articles.length === 0) return;

    for (const article of articles) {
        // 2. Buscar si ya existe un grupo (clúster) con un título parecido
        const { data: existingClusters } = await supabase
            .from('clusters')
            .select('*')
            .eq('status', 'pending');

        let matchedClusterId = null;

        if (existingClusters && existingClusters.length > 0) {
            const titles = existingClusters.map(c => c.topic_name);
            const matches = stringSimilarity.findBestMatch(article.title, titles);

            if (matches.bestMatch.rating > SIMILARITY_THRESHOLD) {
                matchedClusterId = existingClusters[matches.bestMatchIndex].id;
                console.log(`🔗 Agrupando: "${article.title}"`);
            }
        }

        // 3. Si no hay grupo parecido, crear uno nuevo
      // Si no hay grupo parecido, crear uno nuevo
        if (!matchedClusterId) {
            const { data: newCluster } = await supabase
                .from('clusters')
                .insert([{ topic_name: article.title }])
                .select()
                .single();
            
            if (newCluster) {
                matchedClusterId = newCluster.id;
                console.log(`✨ Nuevo grupo: "${article.title}"`);
                
                // ¡REVISA QUE ESTA LÍNEA ESTÉ AQUÍ!
                await sendApprovalRequest(newCluster.id, article.title, 1); 
            }
        }

        // 4. Vincular la noticia al grupo (evitando duplicados en el vínculo)
        if (matchedClusterId) {
            await supabase
                .from('cluster_articles')
                .upsert([{ 
                    cluster_id: matchedClusterId, 
                    raw_article_id: article.id 
                }], { onConflict: 'cluster_id,raw_article_id' });
        }
    }
    console.log("✅ Agrupación terminada.");
}