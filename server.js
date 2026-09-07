require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const {
  GATEWAY_URL = 'https://meta-gateway.clickarg.com',
  GATEWAY_API_KEY,     // tu "mgk_..." de /auth/register
  NUMERO_AGENTE,       // tu número, sin "+", para avisos de handoff
  PORT = 3000,
} = process.env;

const gateway = axios.create({
  baseURL: GATEWAY_URL,
  headers: { 'X-Api-Key': GATEWAY_API_KEY },
});

// -----------------------------
// Estado en memoria por chat
// -----------------------------
const estados = {}; // { numero: { modo: 'menu' | 'humano' } }

// -----------------------------
// Recepción de eventos (el gateway te los reenvía acá)
// -----------------------------
app.get('/webhooks/meta', (req, res) => {
  res.send('Webhook conectado y funcionando correctamente.');
});

app.post('/webhooks/meta', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const mensaje = value?.messages?.[0];

    if (!mensaje) return;

    const from = mensaje.from;
    if (from === NUMERO_AGENTE) return;

    await manejarMensaje(from, mensaje);
  } catch (err) {
    console.error('Error procesando evento:', err.response?.data || err.message);
  }
});

// -----------------------------
// Lógica del bot
// -----------------------------
async function manejarMensaje(from, mensaje) {
  if (!estados[from]) estados[from] = { modo: 'menu' };
  const estado = estados[from];

  let textoPlano = '';
  let idSeleccion = null;

  if (mensaje.type === 'text') {
    textoPlano = mensaje.text.body.trim().toLowerCase();
  } else if (mensaje.type === 'interactive') {
    const interactive = mensaje.interactive;
    if (interactive.type === 'list_reply') idSeleccion = interactive.list_reply.id;
    if (interactive.type === 'button_reply') idSeleccion = interactive.button_reply.id;
  }

  // MODO HUMANO
  if (estado.modo === 'humano') {
    if (['menu', 'menú', 'bot'].includes(textoPlano)) {
      estado.modo = 'menu';
      await enviarTexto(from, 'Volviste al asistente virtual 🤖');
      await enviarMenu(from);
    }
    return;
  }

  // MODO MENU
  if (['hola', 'menu', 'menú'].includes(textoPlano) || idSeleccion === 'ver_menu') {
    await enviarMenu(from);
    return;
  }

  // RESPUESTAS DIRECTAS FINALES
  const RESPUESTAS_DIRECTAS = {
    opt_horarios: 'Atendemos de lunes a viernes de 08:00 a 12:00hs y de 16:00 a 20:00hs. 🕘',
    opt_correos: 'Te compartimos nuestros correos de contacto:\n\n- Consultas generales: saufrre@gmail.com\n- Bienestar estudiantil: bienestar.frre@gmail.com\n- Área de graduados y desarrollo profesional: desarrolloprofesional@gfe.frre.utn.edu.ar\n- Pasantías universitarias: pasantias.frre@gmail.com\n- Área de becas: becas.utn.frre@gmail.com\n- Compromiso universitario social: cus.utn@gmail.com 📧',
    
    // RESPUESTAS PLACEHOLDER DE CADA ÁREA (Para ir completando a mano luego)
    bienestar_q1: 'Respuesta placeholder para Bienestar - Opción 1. Podés agregar la info real acá.',
  bienestar_q2: 'Fomentamos el bienestar integral de la comunidad UTN FRRe a través de la actividad física. Organizamos prácticas deportivas, torneos, gestionamos la infraestructura y preparamos a nuestros equipos representativos.\n\nSumate a nuestros equipos:\n🏀Basketball\n Femenino: Prof. Natalia Fernández\n Masculino: Prof. Guillermo Tuckey\n\n⚽Futbol\n Femenino: Prof. Julio Yurca\n Masculino: Prof. Gustavo Montes\n\n🏐Voley\n Femenino: Prof. Julia Blasco\n Masculino: Prof. Lucho Puppo\n\n♟️Ajedrez\n Mixto: Prof.Julio Yurca\n\n🏓Pickleball\n Mixto: Prof. Lucho Puppo y Prof. Guillermo Tuckey.',
  bienestar_q3: 'SEGUROS\n\n ¿En qué casos se solicita?\n -Visitas técnicas, prácticas supervisadas, viajes de estudio\n\n¿Qué significa que un seguro sea solicitado con Cláusula de No Repetición?\n-Significa que la aseguradora renuncia a reclamar al tercero beneficiado los importes que hubiera pagado por un siniestro\n\n¿Con cuántos días de anticipación debo solicitar el seguro?\n -Con un mínimo de 10 días hábiles si se requiere Cláusula de No Repetición, y en el caso de que no, con un mínimo de 5 días hábiles.\n\n¿Cómo debo solicitarlo?\n -Lo deben solicitar los profesores/directores a cargo completando el siguiente formulario:\n http://bit.ly/SegurosUTNFRRe', 
    graduados_q1: 'Respuesta placeholder para Graduados - Opción 1.',
    pasantias_q1: 'Respuesta placeholder para Pasantías - Opción 1.',
    becas_q1: 'Becas eMentoring:\nConectan a estudiantes con personas graduadas de la UTN FRRe, especialmente en el exterior. Ofrecen una alternativa de apoyo financiero y/o acompañamiento académico a través de mentorías virtuales para potenciar tu desarrollo\n\nBeca BASE (Ayuda Socio-Económica):\nBrindan apoyo económico a estudiantes en situación de vulnerabilidad para facilitar su acceso y permanencia en la universidad, garantizando la igualdad de oportunidades\n\nBecas BIS (Investigación y Servicio):\nImpulsan tu desarrollo académico y profesional mediante la participación en proyectos clave de la UTN, brindando además la posibilidad de acreditar horas electivas',
    becas_q2: 'Beca Progresar:\nBeca educativa de apoyo económico directo para que continúes tus estudios superiores y te formes profesionalmente en áreas estratégicas.\n\nBeca Manuel Belgrano:\nBeca anual renovable orientada a impulsar tu ingreso y graduación en carreras universitarias clave para el desarrollo tecnológico y productivo del país.',
    cus_q1: 'Respuesta placeholder para CUS - Opción 1.',
  };

  if (idSeleccion && RESPUESTAS_DIRECTAS[idSeleccion]) {
    await enviarTexto(from, RESPUESTAS_DIRECTAS[idSeleccion]);
    await enviarTexto(from, 'Escribí "menu" en cualquier momento para ver las opciones de nuevo.');
    return;
  }

  // MANEJO DE SUBMENÚS MODULARES POR ÁREA
  switch (idSeleccion) {
    case 'area_bienestar':
      return await enviarSubmenuBienestar(from);
    case 'area_graduados':
      return await enviarSubmenuGraduados(from);
    case 'area_pasantias':
      return await enviarSubmenuPasantias(from);
    case 'area_becas':
      return await enviarSubmenuBecas(from);
    case 'area_cus':
      return await enviarSubmenuCUS(from);
    case 'opt_humano':
      estado.modo = 'humano';
      await enviarTexto(
        from,
        'Te estoy conectando con una persona del equipo 🙋\nEn breve te responden por acá. Escribí "menu" para volver al asistente.'
      );
      if (NUMERO_AGENTE) {
        await enviarTexto(NUMERO_AGENTE, `📩 Nuevo chat esperando atención humana: +${from}`);
      }
      return;
  }

  await enviarTexto(from, 'No entendí tu mensaje 🤔');
  await enviarMenu(from);
}

// -----------------------------
// Helpers - Gateway API
// -----------------------------
async function enviarTexto(to, text) {
  return gateway.post('/whatsapp/messages/text', { to, text });
}

// Menú principal sin descripciones y con nuevas opciones
async function enviarMenu(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Asistente Virtual',
    body: '¡Hola! 👋 Elegí una opción para continuar:',
    footer: 'Podés escribir "menu" cuando quieras',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Información General',
        rows: [
          { id: 'opt_horarios', title: 'Horarios de atención' },
          { id: 'opt_correos', title: 'Correos de contacto' },
        ],
      },
      {
        title: 'Consultas por Área',
        rows: [
          { id: 'area_bienestar', title: 'Bienestar Estudiantil' },
          { id: 'area_graduados', title: 'Área de Graduados' },
          { id: 'area_pasantias', title: 'Pasantías' },
          { id: 'area_becas', title: 'Área de Becas' },
          { id: 'area_cus', title: 'Compromiso Social' },
        ],
      },
      {
        title: 'Atención personalizada',
        rows: [
          { id: 'opt_humano', title: 'Hablar con una persona' },
        ],
      },
    ],
  });
}

// -----------------------------
// Plantillas Modulares por Área
// -----------------------------

async function enviarSubmenuBienestar(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Bienestar Estudiantil',
    body: 'Seleccioná tu consulta sobre Bienestar Estudiantil:',
    footer: 'Escribí "menu" para volver al inicio',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Bienestar Estudiantil',
        rows: [
          { id: 'bienestar_q1', title: 'Info sobre el comedor' },
          { id: 'bienestar_q2', title: 'Deportes universitarios' },
          { id: 'bienestar_q3', title: 'Seguros' },
        ],
      }
    ],
  });
}

async function enviarSubmenuGraduados(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Área de Graduados',
    body: 'Seleccioná tu consulta sobre el Área de Graduados:',
    footer: 'Escribí "menu" para volver al inicio',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Graduados',
        rows: [
          { id: 'graduados_q1', title: 'Trámites de título' },
        ],
      }
    ],
  });
}

async function enviarSubmenuPasantias(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Pasantías',
    body: 'Seleccioná tu consulta sobre Pasantías:',
    footer: 'Escribí "menu" para volver al inicio',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Pasantías',
        rows: [
          { id: 'pasantias_q1', title: 'Ofertas disponibles' },
        ],
      }
    ],
  });
}

async function enviarSubmenuBecas(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Área de Becas',
    body: 'Gestionamos becas (Progresar, Manuel Belgrano, BIS, etc.) para garantizar la igualdad de oportunidades universitarias, acompañándote en la inscripción y durante toda tu carrera.\n\nSobre que beca querés consultar, seleccioná una opción:',
    footer: 'Escribí "menu" para volver al inicio',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Becas',
        rows: [
          { id: 'becas_q1', title: 'Becas internas' },
          { id: 'becas_q2', title: 'Becas externas' },
        ],
      }
    ],
  });
}

async function enviarSubmenuCUS(to) {
  return gateway.post('/whatsapp/messages/interactive/list', {
    to,
    header: 'Compromiso Social',
    body: 'Seleccioná tu consulta sobre Compromiso Social (CUS):',
    footer: 'Escribí "menu" para volver al inicio',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Compromiso Social',
        rows: [
          { id: 'cus_q1', title: 'Proyectos vigentes' },
        ],
      }
    ],
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
