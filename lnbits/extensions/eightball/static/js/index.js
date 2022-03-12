/* globals Quasar, Vue, _, VueQrcode, windowMixin, LNbits, LOCALE */

Vue.component(VueQrcode.name, VueQrcode)

const pica = window.pica()

const defaultItemData = {
  unit: 'sat',
  wordlist: []
}

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data() {
    return {
      selectedWallet: null,
      confirmationMethod: 'wordlist',
      wordlistTainted: false,
      eightball: {
        method: null,
        wordlist: [],
        items: []
      },
      itemDialog: {
        show: false,
        data: {...defaultItemData},
        units: ['sat']
      }
    }
  },
  computed: {
    printItems() {
      return this.eightball.items.filter(({enabled}) => enabled)
    }
  },
  methods: {
    openNewDialog() {
      this.itemDialog.show = true
      this.itemDialog.data = {...defaultItemData}
    },
    openUpdateDialog(itemId) {
      this.itemDialog.show = true
      let item = this.eightball.items.find(item => item.id === itemId)
      this.itemDialog.data = item
    },
    imageAdded(file) {
      let blobURL = URL.createObjectURL(file)
      let image = new Image()
      image.src = blobURL
      image.onload = async () => {
        let canvas = document.createElement('canvas')
        canvas.setAttribute('width', 100)
        canvas.setAttribute('height', 100)
        await pica.resize(image, canvas, {
          quality: 0,
          alpha: true,
          unsharpAmount: 95,
          unsharpRadius: 0.9,
          unsharpThreshold: 70
        })
        this.itemDialog.data.image = canvas.toDataURL()
        this.itemDialog = {...this.itemDialog}
      }
    },
    imageCleared() {
      this.itemDialog.data.image = null
      this.itemDialog = {...this.itemDialog}
    },
    disabledAddItemButton() {
      return (
        !this.itemDialog.data.name ||
        this.itemDialog.data.name.length === 0 ||
        !this.itemDialog.data.price ||
        !this.itemDialog.data.description ||
        !this.itemDialog.data.unit ||
        this.itemDialog.data.unit.length === 0
      )
    },
    changedWallet(wallet) {
      this.selectedWallet = wallet
      this.loadgame()
    },
    loadgame() {
      LNbits.api
        .request(
          'GET',
          '/eightball/api/v1/eightball',
          this.selectedWallet.inkey
        )
        .then(response => {
          this.eightball = response.data
          this.confirmationMethod = response.data.method
          this.wordlistTainted = false
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
        })
    },
    async setMethod() {
      try {
        await LNbits.api.request(
          'PUT',
          '/eightball/api/v1/eightball/method',
          this.selectedWallet.inkey,
          {method: this.confirmationMethod, wordlist: this.eightball.wordlist}
        )
      } catch (err) {
        LNbits.utils.notifyApiError(err)
        return
      }

      this.$q.notify({
        message:
          `Method set to ${this.confirmationMethod}.` +
          (this.confirmationMethod === 'wordlist' ? ' Counter reset.' : ''),
        timeout: 700
      })
      this.loadgame()
    },
    async sendItem() {
      let {id, name, image, description, price, unit} = this.itemDialog.data
      const data = {
        name,
        description,
        image,
        price,
        unit
      }

      try {
        if (id) {
          await LNbits.api.request(
            'PUT',
            '/eightball/api/v1/eightball/items/' + id,
            this.selectedWallet.inkey,
            data
          )
        } else {
          await LNbits.api.request(
            'POST',
            '/eightball/api/v1/eightball/items',
            this.selectedWallet.inkey,
            data
          )
          this.$q.notify({
            message: `Item '${this.itemDialog.data.name}' added.`,
            timeout: 700
          })
        }
      } catch (err) {
        LNbits.utils.notifyApiError(err)
        return
      }

      this.loadgame()
      this.itemDialog.show = false
      this.itemDialog.data = {...defaultItemData}
    },
    toggleItem(itemId) {
      let item = this.eightball.items.find(item => item.id === itemId)
      item.enabled = !item.enabled

      LNbits.api
        .request(
          'PUT',
          '/eightball/api/v1/eightball/items/' + itemId,
          this.selectedWallet.inkey,
          item
        )
        .then(response => {
          this.$q.notify({
            message: `Item ${item.enabled ? 'enabled' : 'disabled'}.`,
            timeout: 700
          })
          this.eightball.items = this.eightball.items
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
        })
    },
    deleteItem(itemId) {
      LNbits.utils
        .confirmDialog('Are you sure you want to delete this item?')
        .onOk(() => {
          LNbits.api
            .request(
              'DELETE',
              '/eightball/api/v1/eightball/items/' + itemId,
              this.selectedWallet.inkey
            )
            .then(response => {
              this.$q.notify({
                message: `Item deleted.`,
                timeout: 700
              })
              this.eightball.items.splice(
                this.eightball.items.findIndex(item => item.id === itemId),
                1
              )
            })
            .catch(err => {
              LNbits.utils.notifyApiError(err)
            })
        })
    }
  },
  created() {
    this.selectedWallet = this.g.user.wallets[0]
    this.loadgame()

    LNbits.api
      .request('GET', '/eightball/api/v1/currencies')
      .then(response => {
        this.itemDialog = {...this.itemDialog, units: ['sat', ...response.data]}
      })
      .catch(err => {
        LNbits.utils.notifyApiError(err)
      })
  }
})
