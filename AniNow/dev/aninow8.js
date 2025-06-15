async function searchResults(keyword) {
    console.log('SEARCHING');
    return JSON.stringify([{ title: 'Test show', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/ofchaos.jpg', href: '#' }]);
}

async function extractDetails(url) {
    console.log('DETAILING');
    const details = {
        description: 'Test show',
        aliases: '',
        airdate: ''
    }

    return JSON.stringify([details]);
}

async function extractEpisodes(url) {
    console.log('EPISODING');
    return JSON.stringify([{
        href: '#',
        number: 1
    }]);
}

async function extractStreamUrl(url) {
    console.log('STREAMING');
}