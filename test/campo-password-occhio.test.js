'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// icona "occhio" per mostrare/nascondere la password in tutti i moduli.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadApp.js');

test('ogni input[type=password] statico dell\'HTML viene avvolto e riceve un bottone occhio', async () => {
  const { document } = await loadApp();
  const campi = document.querySelectorAll('input[type=password]');
  assert.ok(campi.length > 2, 'precondizione: ci sono davvero diversi campi password nell\'HTML');
  campi.forEach(input=>{
    const wrap = input.closest('.pw-wrap');
    assert.ok(wrap, `${input.id} deve essere avvolto in .pw-wrap`);
    assert.ok(wrap.querySelector('.pw-toggle-btn'), `${input.id} deve avere il bottone occhio`);
  });
});

test('cliccando il bottone occhio il campo passa da password a testo e viceversa', async () => {
  const { document } = await loadApp();
  const input = document.getElementById('cloudPw');
  const btn = input.closest('.pw-wrap').querySelector('.pw-toggle-btn');
  assert.equal(input.type, 'password');
  btn.click();
  assert.equal(input.type, 'text', 'un clic deve mostrare la password in chiaro');
  btn.click();
  assert.equal(input.type, 'password', 'un secondo clic deve tornare a nasconderla');
});

test('il valore digitato non si perde passando da password a testo', async () => {
  const { document } = await loadApp();
  const input = document.getElementById('regPw');
  input.value = 'passwordSegreta1';
  const btn = input.closest('.pw-wrap').querySelector('.pw-toggle-btn');
  btn.click();
  assert.equal(input.value, 'passwordSegreta1');
});
