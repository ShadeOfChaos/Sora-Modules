(async () => {
    const embedUrl = "https://vidsrc.icu/embed/movie/559969";

    const response = await fetch(embedUrl);
    const html = await response.text();


    const videoRegex = /iframe id="videoIframe" src="([\s\S]+?)"/;
    const videoMatch = html.match(videoRegex);
    if(videoMatch == null) {
        console.log('Error video match failed');
        return null;
    }
    const videoUrl = videoMatch[1];


    const videoResponse = await fetch(videoUrl);
    const videoHtml = await videoResponse.text();

    const iframeRegex = /id="player_iframe"[\s\S]+?src="([\s\S]+?)"/;
    const iframeMatch = videoHtml.match(iframeRegex);
    if(iframeMatch == null) {
        console.log('Error iframe match failed');
        return null;
    }
    const iframeUrl = iframeMatch[1];
    const iframeFullUrl = 'https:' + iframeUrl;

    const iframeResponse = await fetch(iframeFullUrl);
    const iframeHtml = await iframeResponse.text();
    
    const iframe2Regex = /src: '([\s\S]+?)'/;
    const iframe2Match = iframeHtml.match(iframe2Regex);
    if(iframe2Match == null) {
        console.log('Error iframe2 match failed');
        return null;
    }

    const index = iframeFullUrl.indexOf('/rcp');
    const baseUrl = iframeFullUrl.substring(0, index);
    const iframe2Url = baseUrl + iframe2Match[1];

    const iframe2Response = await fetch(iframe2Url, { headers: { 'Referer': iframeFullUrl } });
    const iframe2Html = await iframe2Response.text();

    const sourceRegex = /id:"player_parent", file: '([\s\S]+?)'/;
    const sourceMatch = iframe2Html.match(sourceRegex);
    if(sourceMatch == null) {
        console.log('Error source match failed');
        return null;
    }

    const source = sourceMatch[1];
    console.log(source);
})();