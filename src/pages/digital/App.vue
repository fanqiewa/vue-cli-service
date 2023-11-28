<template>
  <div id="app">
    <!-- <img alt="Vue logo" src="../../assets/logo.png"> -->
    <HelloWorld msg="Welcome to Your Vue.js App"/>
    <microbankDemo />
  </div>
</template>

<script>
import HelloWorld from '@/common/components/HelloWorld.vue'
import microbankDemo from '../microbank/microbankDemo.vue'

export default {
  name: 'App',
  components: {
    HelloWorld,
    microbankDemo
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
