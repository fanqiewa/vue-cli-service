import './setPublicPath'
import Vue from 'vue'
import wrap from '@vue/web-component-wrapper'

import 'css-loader/dist/runtime/api.js'
import 'vue-style-loader/lib/addStylesShadow'
import 'vue-loader/lib/runtime/componentNormalizer'

import myElement from '~root/src/App.vue?shadow'
window.customElements.define('my-element', wrap(Vue, myElement))