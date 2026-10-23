import minimap from './minimap';


const chat: {
    minimap: typeof minimap
} = { minimap };


export default chat;
export type { ChatMinimapAttributes, ChatMinimapRange, ChatMinimapSide, ChatMinimapTurn } from './minimap';
