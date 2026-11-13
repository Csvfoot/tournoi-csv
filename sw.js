// Tournoi CSV V6.0 - application shell cache. Never cache Firestore/auth API responses.
const CACHE = 'tournoi-csv-shell-v6.0';
const CORE = ['./','./index.html','./app.js?v=6.0','./styles.css?v=6.0','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./imprimer.html','./affiche-qr.html','./manifest.webmanifest'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js'
];
const LIB_HOSTS=new Set(['cdnjs.cloudflare.com','www.gstatic.com']);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // One failed CDN does not block the installation of the offline shell.
    await Promise.allSettled(CORE.map(async name=>{
      try{const response=await fetch(new Request(new URL(name,self.registration.scope),{cache:'reload'}));
        if(response.ok)await cache.put(new URL(name,self.registration.scope),response);
      }catch(e){}
    }));
    await Promise.allSettled(LIBS.map(async url=>{
      try{const request=new Request(url,{mode:'no-cors'});const response=await fetch(request);
        if(response.ok||response.type==='opaque')await cache.put(request,response);
      }catch(e){}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('tournoi-csv-shell-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url),base=new URL(self.registration.scope);
  // Same-origin static files, plus explicitly pinned JS libraries. No Firebase API/data caching here.
  const own=url.origin===base.origin&&url.pathname.startsWith(base.pathname);
  const external=LIB_HOSTS.has(url.hostname)&&/\.(?:js)(?:$|\?)/.test(url.pathname);
  if(!own&&!external)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{const fresh=await fetch(request);if(fresh.ok)await cache.put(request,fresh.clone());return fresh;}
      catch(e){return (await cache.match(request,{ignoreSearch:true}))||(await cache.match(new URL('./index.html',base)))||Response.error();}
    })());return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);const saved=await cache.match(request);
    if(saved)return saved;
    try{const response=await fetch(request);if(response.ok||response.type==='opaque')await cache.put(request,response.clone());return response;}
    catch(e){return (await cache.match(request,{ignoreSearch:true}))||Response.error();}
  })());
});
