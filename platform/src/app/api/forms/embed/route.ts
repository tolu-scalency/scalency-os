// The embed script: one <script> tag puts a form on any website.
//
//   <script src="https://os.scalency.us/api/forms/embed" data-form="<form id>" async></script>
//
// data-mode     inline (default) | popup | slide
// data-trigger  for popup and slide: button (default) | load | delay | scroll | exit
// data-delay    seconds, for "delay" (default 5)
// data-scroll   percent of the page, for "scroll" (default 50)
// data-button   button text, for "button" (default "Get in touch")
// data-color    button colour, e.g. #0a5fe3
// data-once     "true": show automatically at most once per visitor
//
// Any element with data-scalency-open="<form id>" also opens that form's popup.

export const dynamic = "force-static";

const SCRIPT = String.raw`(function(){
var s=document.currentScript;if(!s)return;
var id=s.getAttribute("data-form");if(!id||!/^[0-9a-f-]{36}$/i.test(id))return;
var base=new URL(s.src).origin;
var mode=s.getAttribute("data-mode")||"inline";
var trig=s.getAttribute("data-trigger")||"button";
var delay=Math.max(0,Number(s.getAttribute("data-delay")||5));
var scroll=Math.min(100,Math.max(1,Number(s.getAttribute("data-scroll")||50)));
var label=s.getAttribute("data-button")||"Get in touch";
var color=s.getAttribute("data-color")||"#0a5fe3";
var once=s.getAttribute("data-once")==="true";
var key="scalency-form-shown-"+id;
function src(){var q=location.search?location.search.slice(1)+"&":"";return base+"/f/"+id+"?embed=1&"+q+"page="+encodeURIComponent(location.href)}
function frame(minH){var f=document.createElement("iframe");f.src=src();f.title="Form";f.loading=mode==="inline"?"eager":"lazy";f.setAttribute("allow","clipboard-write");f.style.cssText="width:100%;border:0;display:block;min-height:"+minH+"px;background:transparent";window.addEventListener("message",function(e){if(e.origin!==base||!e.data||e.data.scalencyForm!==id)return;if(e.data.height)f.style.height=e.data.height+"px";if(typeof e.data.redirect==="string"&&/^https:\/\//.test(e.data.redirect))location.href=e.data.redirect});return f}
if(mode==="inline"){var box=document.createElement("div");box.className="scalency-form";box.appendChild(frame(480));s.parentNode.insertBefore(box,s);return}
var open=false,wrap,panel;
function build(){
 wrap=document.createElement("div");
 var dim=mode==="popup";
 wrap.style.cssText="position:fixed;inset:0;z-index:2147483000;display:none;"+(dim?"background:rgba(8,15,30,.55);align-items:center;justify-content:center;padding:16px;":"pointer-events:none;");
 panel=document.createElement("div");
 panel.style.cssText=(dim?"position:relative;width:100%;max-width:620px;max-height:92vh;overflow:auto;":"position:fixed;right:16px;bottom:16px;width:min(420px,calc(100vw - 32px));max-height:80vh;overflow:auto;pointer-events:auto;")+"background:#fff;border-radius:18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.45);padding:14px;transition:transform .25s,opacity .25s";
 var x=document.createElement("button");x.type="button";x.setAttribute("aria-label","Close");x.innerHTML="&times;";
 x.style.cssText="position:absolute;top:6px;right:8px;z-index:2;width:34px;height:34px;border:0;border-radius:10px;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#475569";
 x.onclick=close;panel.appendChild(x);panel.appendChild(frame(420));wrap.appendChild(panel);
 if(dim)wrap.addEventListener("click",function(e){if(e.target===wrap)close()});
 document.addEventListener("keydown",function(e){if(e.key==="Escape")close()});
 document.body.appendChild(wrap);
}
function show(auto){if(open)return;if(auto&&once){try{if(localStorage.getItem(key))return;localStorage.setItem(key,"1")}catch(e){}}if(!wrap)build();wrap.style.display=mode==="popup"?"flex":"block";open=true}
function close(){if(wrap)wrap.style.display="none";open=false}
function ready(fn){if(document.readyState!=="loading")fn();else document.addEventListener("DOMContentLoaded",fn)}
ready(function(){
 document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-scalency-open]");if(t&&t.getAttribute("data-scalency-open")===id){e.preventDefault();show(false)}});
 if(trig==="button"){var b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=function(){show(false)};
  b.style.cssText="font:600 15px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;background:"+color+";border:0;border-radius:999px;padding:14px 22px;cursor:pointer;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);"+(mode==="slide"?"position:fixed;right:16px;bottom:16px;z-index:2147482999;":"");
  s.parentNode.insertBefore(b,s)}
 if(trig==="load")show(true);
 if(trig==="delay")setTimeout(function(){show(true)},delay*1000);
 if(trig==="scroll"){var h=function(){var d=document.documentElement,p=(d.scrollTop+innerHeight)/d.scrollHeight*100;if(p>=scroll){removeEventListener("scroll",h);show(true)}};addEventListener("scroll",h,{passive:true})}
 if(trig==="exit"){var ex=function(e){if(e.clientY<=0){document.removeEventListener("mouseout",ex);show(true)}};document.addEventListener("mouseout",ex)}
});
window.ScalencyForms=window.ScalencyForms||{};window.ScalencyForms[id]={open:function(){show(false)},close:close};
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
