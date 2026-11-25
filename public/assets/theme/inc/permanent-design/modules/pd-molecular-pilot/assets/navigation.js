(function(){
 'use strict';
 var root=document.getElementById('pdms-pilot');if(!root)return;
 var links=Array.from(root.querySelectorAll('.toc a,.mobile-toc a'));
 var sections=Array.from(root.querySelectorAll('.protocol-article>.section'));
 function active(id){links.forEach(function(a){if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
 root.addEventListener('click',function(event){var a=event.target.closest('a[href^="#"]');if(a&&sections.some(function(s){return '#'+s.id===a.hash;}))active(a.hash.slice(1));});
 if('IntersectionObserver' in window){
  var observer=new IntersectionObserver(function(entries){
   var visible=entries.filter(function(e){return e.isIntersecting;}).sort(function(a,b){return a.boundingClientRect.top-b.boundingClientRect.top;});
   if(visible[0])active(visible[0].target.id);
  },{rootMargin:'-110px 0px -55% 0px',threshold:0});
  sections.forEach(function(s){observer.observe(s);});
 }
 active(location.hash.slice(1)||'intro-card');
})();
