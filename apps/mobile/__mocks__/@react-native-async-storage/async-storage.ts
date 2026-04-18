const AsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined)
};

export const getItem = AsyncStorage.getItem;
export const setItem = AsyncStorage.setItem;
export default AsyncStorage;
