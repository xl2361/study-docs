export default {
  async fetch(request) {
    const url = new URL(request.url);
    const rid = url.searchParams.get('rid');
    if (!rid) {
      return new Response('Missing rid param', { status: 400 });
    }
    const kuwoUrl = `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${rid}`;
    const resp = await fetch(kuwoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    const audioUrl = (await resp.text()).trim();
    if (!audioUrl.startsWith('http')) {
      return new Response('Failed to resolve kuwo URL', { status: 502 });
    }
    return Response.redirect(audioUrl, 302);
  },
};
