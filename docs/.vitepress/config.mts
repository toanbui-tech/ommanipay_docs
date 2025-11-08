import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Ommanipay',
    srcDir: './src',
    description: '',
    head: [
      ['link', { rel: 'icon', type: 'image/png', href: './favicon.jpg' }],
    ],
    themeConfig: {
      logo: {
        src: './favicon.jpg',
      },
      search: {
        provider: 'local',
      },
      sidebar: generateSidebar({ 
        documentRootPath: './docs/src',
        collapseDepth: 2,
        useTitleFromFileHeading: true,
        manualSortFileNameByPriority: [
          'customer.md',
        ],
        useFolderTitleFromIndexFile: true,
      })
    },
  })
)
