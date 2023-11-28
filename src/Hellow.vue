<template>
  <div class="table">
    <div class="block" v-for="(item, index) in block" :key="index">
      <div
        :class="['block__item', ele.bgColor]"
        v-for="(ele, idx) in item"
        :key="idx"
      >
        <img v-if="ele.arrow" class="arrow" :src="arrow" alt="">
        {{ ele.name }}
      </div>
    </div>
  </div>
</template>

<script>
const arrow = require('./assets/arrow.png');
export default {
  data() {
    return {
      arrow,
      table: [
        [
          {
            position: 5,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "green",
          },
          {
            position: 6,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "blue",
          },
          {
            position: 7,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "blue",
          },
        ],
        [
          {
            position: 4,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "blue",
          },
          {
            position: 5,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "green",
          },
        ],
        [
          {
            position: 3,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "green",
          },
          {
            position: 4,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "blue",
          },
          {
            position: 5,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "green",
          },
        ],
        [
          {
            position: 2,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "green",
          },
          {
            position: 3,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "blue",
          },
          {
            position: 5,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "green",
          },
        ],
        [
          {
            position: 1,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "blue",
          },
          {
            position: 2,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "green",
          },
          {
            position: 3,
            name: "TC297",
            link: "www.baidu.com",
            arrow: true,
            bgColor: "blue",
          },
        ],
        [
          {
            position: 1,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "blue",
          },
          {
            position: 2,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "green",
          },
          {
            position: 3,
            name: "TC297",
            link: "www.baidu.com",
            bgColor: "blue",
          },
        ],
      ],
    };
  },
  computed: {
    block() {
      let block = [];
      for (let i = 0; i < 7; i++) {
        // 行
        block.push([]);
        for (let j = 0; j < 8; j++) {
          // 列
          block[i].push({
            position: j,
          });
        }
      }

      for (let i = 0; i < this.table.length; i++) {
        let item = this.table[i];

        for (let ele of item) {
          block[i][ele.position] = ele;
        }
      }
      console.log(block);
      return block;
    },
  },
  created() {},
};
</script>
<style scoped>
.table {
  background: url("./assets/table.png");
  background-size: 100%;
  width: 1128px;
  height: 493px;
}
.block {
  display: flex;
}
.block__item {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 140px;
  height: 70px;
  border: 1px solid #fff;
}
.arrow {
  position: absolute;
  bottom: -20px;
  z-index: 1;
  width: 15px;
  height: 40px;
}
.green {
  background: #bec88c;
}
.blue {
  background: #b4cbc5;
}
</style>

