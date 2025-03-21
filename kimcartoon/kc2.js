async function searchResults(keyword) {
    const searchUrl = `https://kimcartoon.com.co/?s=${encodeURIComponent(keyword)}`;
    try {
        const response = await fetch(searchUrl);
        const html = typeof response === 'object' ? await response.text() : await response;
        const results = [];

        const articleRegex = /<article[^>]*class="bs styletwo"[\s\S]*?<\/article>/g;
        const items = html.match(articleRegex) || [];

        items.forEach((itemHtml) => {
            const titleMatch = itemHtml.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"/);
            const imgMatch = itemHtml.match(/<img[^>]*src="([^"]+)"/);

            if (!titleMatch || !imgMatch) return;

            const href = `${titleMatch[1].trim()}?video_index=2`;
            const title = titleMatch[2].trim();
            const imageUrl = imgMatch[1].trim();

            results.push({ title, image: imageUrl, href });
        });
        //console.log(results);
        console.log(JSON.stringify(results));
        return JSON.stringify(results);
    } catch (error) {
        throw error;
    }
}

async function extractDetails(url) {
    const response = await fetch(url);
    const html = typeof response === 'object' ? await response.text() : await response;
    const details = [];
    const descriptionMatch = html.match(/<div class="entry-content" itemprop="description">\s*<p>(.*?)<\/p>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : `N/A`;

    details.push({
        description,
        alias: 'N/A',
        airdate: 'N/A'
    });

    console.log(JSON.stringify(details));
    return JSON.stringify(details);
}

async function extractEpisodes(url) {
    let embedPageData = 'test';

    const response = await fetch(url);
    const html = typeof response === 'object' ? await response.text() : await response;
    const episodes = [];

    const episodeMatches = [...html.matchAll(/<li[^>]*>\s*<a href="([^"]+)">\s*<div class="epl-title">Episode (\d+) <\/div>/g)];
    const movieMatch = html.match(/<li[^>]*>\s*<a href="([^"]+)">\s*<div class="epl-title">Movie <\/div>/);

    for (const match of episodeMatches) {
        episodes.push({
            href: match[1].trim(),
            number: parseInt(match[2], 10)
        });
    }

    try {
        const embedResponse = await fetch(episodes[0].href);
        const data = typeof embedResponse === 'object' ? await embedResponse.text() : await embedResponse;
        const embedMatch = data.match(/<div class="pembed" data-embed="(\/\/.*?)"/);
        const embedUrl = embedMatch[1];
        const embedPageResponse = await fetch('https:' + embedUrl);
        // embedPageData = typeof embedPageResponse === 'object' ? await embedPageResponse.text() : await embedPageResponse;
        embedPageData = await embedPageResponse;
    } catch(error) {
        console.log('===================================================');
        console.log('Error getting embed:' + error.message);
        console.log('embed Status: ' + data.status);
        console.log('embed url: ' + data.url);
        console.log('page Status: ' + embedPageData.status);
        console.log('page url: ' + embedPageData.status);
        console.log('EmbedPageData: ' + embedPageData);
    }

    if (movieMatch) {
        episodes.push({
            href: movieMatch[1].trim(),
            number: 1,
            test: embedPageData
        });
    }

    //console.log(episodes);
    console.log(JSON.stringify(episodes));
    return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
    const embedResponse = await fetch(url);
    const data = typeof embedResponse === 'object' ? await embedResponse.text() : await embedResponse;

    const embedMatch = data.match(/<div class="pembed" data-embed="(\/\/.*?)"/);

    if (embedMatch && embedMatch[1]) {
        const embedUrl = embedMatch[1];

        const embedPageResponse = await fetch('https:' + embedUrl);
        const embedPageData = typeof embedPageResponse === 'object' ? await embedPageResponse.text() : await embedPageResponse;

        const m3u8Match = embedPageData.match(/sources:\s*\[\{file:"(https:\/\/[^"]*\.m3u8)"/);

        if (m3u8Match && m3u8Match[1]) {
            const m3u8Url = m3u8Match[1];
            return m3u8Url;
        } else {
            console.log("M3U8 URL not found.");
            return null;
        }
    } else {
        console.log("Embed URL not found.");
        return null;
    }
}
