import{r as i,j as e}from"./vendor-react-nkeu7MKf.js";import{c as r,j as f}from"./index-Cgh2aQl7.js";import"./vendor-markdown-zaQAhtrl.js";import"./vendor-recharts-COauwCrp.js";import"./vendor-radix-Oq5tdvA1.js";import"./vendor-floating-ui-_Y3uXdsy.js";import"./vendor-router-bCYKpmtI.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=r("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=r("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]]);function y(){const[n,a]=i.useState(navigator.onLine),[d,t]=i.useState(!1);return i.useEffect(()=>{const s=()=>{a(!0),t(!0),setTimeout(()=>{t(!1)},3e3)},o=()=>{a(!1),t(!1)};return window.addEventListener("online",s),window.addEventListener("offline",o),()=>{window.removeEventListener("online",s),window.removeEventListener("offline",o)}},[]),n&&!d?null:e.jsx("div",{className:"fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5",children:e.jsx("div",{className:f("flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium",n?"bg-green-500/90 text-white backdrop-blur-sm":"bg-orange-500/90 text-white backdrop-blur-sm"),children:n?e.jsxs(e.Fragment,{children:[e.jsx(c,{className:"w-4 h-4"}),e.jsx("span",{children:"Back online"})]}):e.jsxs(e.Fragment,{children:[e.jsx(l,{className:"w-4 h-4"}),e.jsx("span",{children:"Working offline"})]})})})}export{y as OfflineIndicator};
