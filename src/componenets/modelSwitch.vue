<template>
    <div class="container">
        <div class="chosenOne" style="display: flex;">
            <img src="" alt="" ref="choseIcon" style="height: 20px;width: 20px;">
            <div class="showLabel" @click="showModels = true">{{ modelShowing }}</div>
        </div>

        <div class="models" v-show="showModels">
            <div class="option" v-for="(model, index) in modelIds" style="display: flex;" @click="choseModel(model)">
                <img :src="model.icon" style="height: 20px;width: 20px;">
                <div class="contentArea">{{ model.name }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { modelIdChosen, modelIds } from '@/states/user';
import { onMounted, ref } from 'vue';

const choseIcon = ref(null)
const showModels = ref(false)

onMounted(async () => {
    //  获取模型列表
    const responseModel = await fetch('http://scj.dolmo.top:3001/api/chat/models')
    const dataModel = await responseModel.json()
    modelIds.value = dataModel.data.map((item) => ({ id: item.id, icon: item.icon, name: item.name }))
    choseIcon.value.src=modelIds.value[0].icon
})

const modelShowing = ref('Qwen2.5-7B')
const choseModel = (model) => {
    choseIcon.value.src = model.icon
    modelShowing.value = model.name
    modelIdChosen.value = model.id
    console.log('选中模型',modelIdChosen.value);
    showModels.value = false
}

console.log(1);
console.error(1);
</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
    /* overflow-y: auto; */
    height: 320px;
    width: 170px;
    border-radius: 20px;
    overflow: hidden;
}

.container::-webkit-scrollbar {
    display: none;
}

.option {
    /* align-items: center; */
    padding: 8px;
    min-height: 30px;
    width: 150px;
    background-color: antiquewhite;
    /* overflow: hidden; */
}
</style>
