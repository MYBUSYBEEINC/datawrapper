!function(){"use strict";const t=new Set(["0","false","null"]),e={allowEditing:Boolean,dark:function(e){return"auto"===e?e:!!e&&!t.has(e)},fitchart:Boolean,fitheight:Boolean,logo:String,logoId:String,map2svg:Boolean,plain:Boolean,previewId:String,search:String,static:Boolean,svgonly:Boolean,theme:String,transparent:Boolean};function n(n){let r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:e;return Object.fromEntries(Object.entries(r).map((e=>{let[r,o]=e;const i=n(r);return o===Boolean?[r,!!i&&!t.has(i)]:[r,i&&o(i)]})))}function r(t){let r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:e;return n((e=>t.getAttribute(`data-${e}`)),r)}var o={},i={};Object.defineProperty(i,"__esModule",{value:!0}),i.getValueOrDefault=void 0;i.getValueOrDefault=(t,e,n)=>t&&e(t)?t:n(),Object.defineProperty(o,"__esModule",{value:!0}),o.loadStylesheet=c=o.loadScript=o.deleteJSON=o.patchJSON=o.putJSON=o.postJSON=o.getJSON=o.fetchJSON=void 0;const a=i;function l(t,e,n,r,o){const i={method:e,body:r,mode:"cors",credentials:n};return window.fetch(t,i).then((t=>{if(!t.ok)throw new Error(t.statusText);return t.text()})).then((t=>{try{return JSON.parse(t)}catch(e){return console.warn("malformed json input",t),t}})).then((t=>(o&&o(t),t))).catch((t=>{if(!o)throw t;console.error(t)}))}o.fetchJSON=l,o.getJSON=function(t,e,n){let r,o;return 2===arguments.length&&"function"==typeof e?(o=e,r="include"):1===arguments.length?(o=void 0,r="include"):(o=n,r=e),l(t,"GET",r,null,o)},o.postJSON=function(t,e,n){return l(t,"POST","include",e,n)},o.putJSON=function(t,e,n){return l(t,"PUT","include",e,n)},o.patchJSON=function(t,e,n){return l(t,"PATCH","include",e,n)},o.deleteJSON=function(t,e){return l(t,"DELETE","include",null,e)};var c=o.loadScript=function(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;return new Promise(((n,r)=>{const o=document.createElement("script");o.src=t,o.onload=()=>{e&&e(),n()},o.onerror=r,document.body.appendChild(o)}))};function s(t,e,n){return n?e?e(t):t:(t&&t.then||(t=Promise.resolve(t)),e?t.then(e):t)}o.loadStylesheet=function(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;"string"==typeof t&&(t={src:t});const n=t,r=(0,a.getValueOrDefault)(n.parentElement,(t=>"function"==typeof t.appendChild),(()=>document.head));return new Promise(((t,o)=>{const i=document.createElement("link");i.rel="stylesheet",i.href=n.src,i.onload=()=>{e&&e(),t()},i.onerror=o,r.appendChild(i)}))};const u={};function d(t){return function(){for(var e=[],n=0;n<arguments.length;n++)e[n]=arguments[n];try{return Promise.resolve(t.apply(this,e))}catch(t){return Promise.reject(t)}}}const p={};window.datawrapper||(window.datawrapper={chartData:u,render:d((function(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};t.script=document.currentScript;const n=t.origin=e.origin||(t.chart.publicUrl||"").replace(/\/$/,"");window.datawrapper.chartData[t.chart.id]=Promise.resolve(t);const o=`datawrapper-vis-${t.chart.id}`,i=e.target||document.createElement("div");i.setAttribute("id",o),e.target||t.script.parentNode.insertBefore(i,t.script);const a=e.flags||r(t.script);if(!("customElements"in window)){const e=document.createElement("iframe");return e.src=t.script.getAttribute("src").replace("/embed.js",""),e.setAttribute("title",t.chart.title),e.setAttribute("scrolling","no"),e.setAttribute("frameborder","0"),e.setAttribute("style","width: 0; min-width: 100% !important; border: none;"),e.setAttribute("height",t.chart.metadata.publish["embed-height"]),e.setAttribute("data-external",1),void i.appendChild(e)}const l={target:i,props:{outerContainer:i,dependencyPromises:window.datawrapper.dependencyPromises,renderFlags:a,isAutoDark:"auto"===a.dark||!0!==a.dark&&!1!==a.dark&&t.chartAutoDark,...t},hydrate:!1},u=d((function(t){return p[t]||(p[t]=c(0===t.indexOf("http")?t:`${n}/${t}`)),p[t]})),[h,f,...m]=t.dependencies;return s(Promise.all([u(h),u(f)]),(function(){return s(Promise.all(m.map((t=>u(t)))),(function(){const{VisualizationWebComponent:t}=window.datawrapper;if(customElements.get("datawrapper-visualization")){new(customElements.get("datawrapper-visualization"))(l)}else customElements.define("datawrapper-visualization",t),new t(l)}))}))}))})}();