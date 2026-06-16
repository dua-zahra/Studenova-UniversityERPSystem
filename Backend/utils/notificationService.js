// const Notification = require('../models/Notification');

// exports.sendNotification = async ({ type, title, message, recipients, data }) => {
//   try {
//     const notifications = recipients.map(recipientId => ({
//       type,
//       title,
//       message,
//       recipient: recipientId,
//       data,
//       status: 'unread'
//     }));

//     await Notification.insertMany(notifications);


    
//     console.log(`Sent ${notifications.length} notifications for ${type}`);
    
//     return true;
//   } catch (error) {
//     console.error('Error sending notifications:', error);
//     throw error;
//   }
// };