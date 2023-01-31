const { db, rabbitmq, _ } = require('@cowellness/cw-micro-service')()

/**
 * @class TrendcontactsController
 * @classdesc Controller Trendcontacts
 */
class TrendcontactsController {
  constructor () {
    this.Trendcontacts = db.stats.model('Trendcontacts')
  }

  async collectStats () {
    const { data } = await rabbitmq.sendAndRead('/auth/stats/getChatStats')

    return Promise.all(data.map(entry => {
      const date = new Date()
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()

      return this.updateOrCreate({
        ownerId: entry.ownerId,
        year,
        month,
        day,
        entry: entry.data
      })
    }))
  }

  async updateOrCreate (data) {
    const contactData = await this.Trendcontacts.findOne({
      ownerId: data.ownerId,
      year: data.year,
      month: data.month
    })

    if (contactData) {
      contactData.data = {
        ...contactData.data,
        [data.day]: data.entry
      }
      return contactData.save()
    }
    return this.Trendcontacts.create({
      ownerId: data.ownerId,
      year: data.year,
      month: data.month,
      data: {
        [data.day]: data.entry
      }
    })
  }

  async getContactsMonth ({ _user }) {
    const contacts = await this.Trendcontacts.find({
      ownerId: _user.profileId
    })
    const result = {}

    contacts.forEach(entry => {
      result[`${entry.year}.${entry.month}`] = { year: entry.year, month: entry.month }
    })
    return Object.values(result)
  }

  async getContactsStats ({ _user, periods, type = 'year' }) {
    let previousPeriods = null

    if (type === 'year') {
      previousPeriods = periods.map(period => ({ year: period.year - 1, month: period.month }))
    } else if (type === 'month') {
      previousPeriods = periods.map(period => ({ year: period.year, month: period.month - 1 }))
    }
    const currentPeriod = await this.Trendcontacts.find({
      ownerId: _user.profileId,
      $or: periods
    })
    const previousPeriod = await this.Trendcontacts.find({
      ownerId: _user.profileId,
      $or: previousPeriods
    })
    return {
      current: currentPeriod.map(c => _.pick(c, ['data', 'month', 'year'])),
      previous: previousPeriod.map(c => _.pick(c, ['data', 'month', 'year']))
    }
  }
}

module.exports = TrendcontactsController
