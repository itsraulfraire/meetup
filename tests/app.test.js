
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Cargar el código real de Meetup Planner
const codigo = fs.readFileSync(
  path.join(__dirname, '../js/app.js'),
  'utf8'
);

// Simular los registros de eventos del navegador
const jquerySimulado = () => ({
  on() { return this; },
  ready() { return this; }
});

const contexto = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: { addEventListener() {} },
  window: { addEventListener() {} },
  $: jquerySimulado,
  setTimeout() {},
  setInterval() {},
  clearTimeout() {},
  clearInterval() {}
};

vm.createContext(contexto);
vm.runInContext(codigo, contexto, { timeout: 1000 });

// Ejecutar las funciones originales de app.js
function ejecutar(funcion, ...argumentos) {
  contexto.argumentosPrueba = argumentos;
  return vm.runInContext(
    `${funcion}(...argumentosPrueba)`,
    contexto,
    { timeout: 1000 }
  );
}

// PRUEBAS DE PIN
test('PIN de 4 números es válido', () => {
  assert.equal(ejecutar('validarFormatoPIN', '1234'), true);
});

test('PIN de 6 números es válido', () => {
  assert.equal(ejecutar('validarFormatoPIN', '123456'), true);
});

test('PIN de 3 números es rechazado', () => {
  assert.equal(ejecutar('validarFormatoPIN', '123'), false);
});

test('PIN con letras es rechazado', () => {
  assert.equal(ejecutar('validarFormatoPIN', '12ab'), false);
});

// PRUEBAS DE CORREO
test('Correo de invitación válido', () => {
  assert.equal(
    ejecutar('correoInvitacionValido', 'usuario@gmail.com'),
    true
  );
});

test('Correo sin arroba es rechazado', () => {
  assert.equal(
    ejecutar('correoInvitacionValido', 'usuariogmail.com'),
    false
  );
});

test('Correo sin dominio es rechazado', () => {
  assert.equal(
    ejecutar('correoInvitacionValido', 'usuario@'),
    false
  );
});

// PRUEBAS DE BÚSQUEDA
test('Normalizar mayúsculas y acentos', () => {
  assert.equal(
    ejecutar('normalizarBusquedaEvento', '  REUNIÓN  '),
    'reunion'
  );
});

test('Normalizar búsqueda vacía', () => {
  assert.equal(
    ejecutar('normalizarBusquedaEvento', ''),
    ''
  );
});

// PRUEBAS DE ESTADOS
test('Invitación confirmada usa color success', () => {
  assert.equal(
    ejecutar('obtenerColorEstadoInvitacion', 'Confirmado'),
    'success'
  );
});

test('Invitación pendiente usa color warning', () => {
  assert.equal(
    ejecutar('obtenerColorEstadoInvitacion', 'Pendiente'),
    'warning'
  );
});

test('Invitación cancelada usa color danger', () => {
  assert.equal(
    ejecutar('obtenerColorEstadoInvitacion', 'Cancelado'),
    'danger'
  );
});

test('Estado desconocido usa color secondary', () => {
  assert.equal(
    ejecutar('obtenerColorEstadoInvitacion', 'Desconocido'),
    'secondary'
  );
});