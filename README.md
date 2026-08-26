# Registro de Atenciones — Residentes

App web para registrar atenciones diarias a residentes, con búsqueda,
historial por fecha y ficha individual por residente. Los datos se
guardan en el navegador (localStorage) y ya viene precargada con la
nómina de residentes que entregaste.

⚠️ **Importante — datos sensibles:** esta app contiene nombres y
antecedentes médicos reales de personas mayores. Trátala como
información clínica confidencial: no la subas a un repositorio
público de GitHub, no compartas la URL de forma abierta, y sigue las
políticas de datos de tu institución/ELEAM antes de usarla en
producción.

## 1. Requisitos

- Tener instalado Node.js (versión 18 o superior) — nodejs.org

## 2. Instalación y ejecución local

Abre una terminal dentro de esta carpeta y ejecuta:

```bash
npm install
npm run dev
```

Esto abrirá la app en http://localhost:5173 . Pruébala ahí antes de
publicarla: agrega, edita y revisa atenciones para confirmar que todo
funciona como esperas en tu computador.

## 3. Publicarla (dejarla operativa en internet)

La forma más simple y gratuita es Vercel. Pasos:

1. Crea una cuenta en vercel.com (puedes entrar con GitHub).
2. Sube este proyecto a un repositorio de GitHub — créalo como
   privado, no público, porque contiene datos de salud reales:
   ```bash
   git init
   git add .
   git commit -m "Registro de atenciones"
   ```
   Luego crea el repo privado en GitHub y sigue las instrucciones que
   te da GitHub para subir el código (git remote add origin ...,
   git push).
3. En Vercel, elige "Add New Project" e importa ese repositorio.
4. Deja la configuración por defecto (Vercel detecta Vite
   automáticamente: build command `npm run build`, output `dist`).
5. Click en Deploy. En 1-2 minutos te entrega una URL tipo
   https://tu-app.vercel.app
6. Protege el acceso. Por defecto esa URL queda abierta a cualquiera
   que la tenga. Opciones:
   - Si tienes plan Vercel Pro: activa "Password Protection" en la
     configuración del proyecto.
   - Alternativa gratuita: usa Netlify en vez de Vercel y activa
     "Password protection" en Site settings → Access control (viene
     en el plan gratuito de Netlify para un sitio).
   - O simplemente no publiques la URL fuera de tu equipo de trabajo
     y trátala como un enlace interno.

Cada vez que quieras actualizar la app, haz cambios, `git commit` y
`git push`: Vercel/Netlify vuelven a desplegar solo.

## 4. Limitación importante de este modo (localStorage)

Los datos se guardan en el navegador de cada dispositivo, no en un
servidor. Esto significa:

- Si usas la app desde el computador y luego desde el celular, no vas
  a ver los mismos datos — cada dispositivo tiene su propia copia.
- Si borras el caché/datos del navegador, se pierde la información.
- Es perfecto para uso individual desde un mismo dispositivo, pero no
  para que varios profesionales carguen atenciones desde equipos
  distintos y las vean todos juntos.

## 5. Cómo migrar a una base de datos real (opcional, a futuro)

El código está preparado para este cambio: toda la persistencia pasa
por un único archivo, src/storage.js, con dos funciones (get y set).
El resto de la app no sabe ni le importa de dónde vienen los datos.

Para pasar a un backend real con datos compartidos entre
dispositivos, la opción más simple es Supabase (Postgres gratis con
API lista para usar):

1. Crea un proyecto en supabase.com.
2. Crea dos tablas: residents y attentions, con las mismas columnas
   que ya usa la app (id, nombre, edad, estado, observaciones / id,
   residentId, fecha, hora, observacion, estado, usuario).
3. Reemplaza src/storage.js para que en vez de localStorage haga
   consultas a Supabase con su cliente JS (@supabase/supabase-js).
4. El resto del proyecto (App.jsx) no necesita cambios.

Si en algún momento quieres ayuda con ese paso, dímelo y armamos esa
versión.
