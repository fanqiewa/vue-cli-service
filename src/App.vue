<template>
  <div id="app">
    <!-- <img alt="Vue logo" src="./assets/logo.png">
    <HelloWorld msg="Welcome to Your Vue.js App"/>
    <button @click="getData">获取数据</button>  -->
    <Hellow />
  </div>
</template>

<script>
// import HelloWorld from './components/HelloWorld.vue'
import Hellow from './Hellow.vue'
import axios from 'axios';

export default {
  name: 'App',
  components: {
    // HelloWorld,
    Hellow
  },
  methods: {
    getData() {
      axios.get("/api/getData")
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
