<template>
    <div class="container">
        <div class="chosenOne" style="display: flex;">
            <img src="" alt="" ref="choseIcon" style="height: 20px;width: 20px;">
            <div class="showLabel" @click="showModels = true">{{ modelShowing }}</div>
        </div>

        <div class="models" v-show="showModels">
            <div class="option" v-for="model in modelIds" style="display: flex;" @click="choseModelHandler(model)">
                <img :src="model.icon" style="height: 20px;width: 20px;">
                <div class="contentArea">{{ model.name }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import getFetch from '@/utils/getFetch';
import { onMounted, ref } from 'vue';
import { useModelStore } from '@/states/useModelStore';
import { storeToRefs } from 'pinia';

const modelStore = useModelStore()
const { modelIds, modelIdChosen } = storeToRefs(modelStore)
const choseIcon = ref(null)
const showModels = ref(false)

onMounted(async () => {
    //  获取模型列表
    const dataModel = await getFetch(`/api/chat/models`)
    modelIds.value = dataModel.data.map((item) => ({ id: item.id, icon: item.icon, name: item.name }))
    choseIcon.value.src = modelIds.value[0].icon
})

const modelShowing = ref('Qwen2.5-7B')
const choseModelHandler = (model) => {
    choseIcon.value.src = model.icon
    modelShowing.value = model.name
    modelIdChosen.value = model.id
    console.log('选中模型', modelIdChosen.value);
    showModels.value = false
}

</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
    height: 320px;
    width: 170px;
    border-radius: 20px;
    overflow: hidden;
}

.container::-webkit-scrollbar {
    display: none;
}

.option {
    padding: 8px;
    width: 150px;
    background-color: antiquewhite;
}
</style>
