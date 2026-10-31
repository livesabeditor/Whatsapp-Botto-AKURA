export const akuraGroupLinks = [
    {
        name: '亗 𝔸𝕂𝕌ℝ𝔸 | ℍ𝕀𝔾ℍℝ𝕆𝕃𝕃𝔼ℝ𝕊 𝟙 亗',
        url: 'https://chat.whatsapp.com/GNVRmX4haa4BuSLoSZqteG?s=cl&p=a&mlu=4&ilr=4&iam=2'
    },
    {
        name: '亗 𝔸𝕂𝕌ℝ𝔸 | ℍ𝕀𝔾ℍℝ𝕆𝕃𝕃𝔼ℝ𝕊 𝟚 亗',
        url: 'https://chat.whatsapp.com/JkqGJZ35q7dCgKMQJ29CWc?s=cl&p=a&mlu=4&ilr=4&iam=2'
    },
    {
        name: '亗 𝔸𝕂𝕌ℝ𝔸 | 𝔸ℝℂ𝔸𝔻𝔼 𝟙 亗',
        url: 'https://chat.whatsapp.com/KS5pJKDg8Ml3IOJxJADfsu?s=cl&p=a&mlu=4&ilr=4&iam=2'
    },
    {
        name: '亗 𝔸𝕂𝕌ℝ𝔸 | 𝔸ℝℂ𝔸𝔻𝔼 𝟚 亗',
        url: 'https://chat.whatsapp.com/DVzIwQjyw4G5xyySyso47k?s=cl&p=a&mlu=4&ilr=4&iam=2'
    }
] as const

export const formatAkuraGroupLinks = (): string => akuraGroupLinks.map(({ name, url }) => `${name}\n${url}`).join('\n\n')
