import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { books } from './src/db/schema';
// Ensure 'dotenv' is configured if you aren't running this via a runner that handles env vars
import 'dotenv/config'; 

const client = createClient({
  url: "libsql://kafka-books-arjundubey.aws-eu-west-1.turso.io",
  authToken:"eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjYyNDIwOTIsImlkIjoiZmY3OWRhMGQtMzhkMi00ODhkLWFhNGUtNTk1YzUxOGU2YTBhIiwicmlkIjoiOTE5MTlmZTYtZjg0Ny00OTc3LWFhZjItY2NjOTA2MjMwNDEzIn0.IvUiSVTlyPTEvlAoTuKYjWvYCw44A8ssG0bqTqZiIBgEDRS4JTdq0--m9Op8OeIktvLjsM2X-G1YnZuY1QQGDA",
});
const db = drizzle(client);

const main = async () => {
  try {
    console.log('Adding books...');
    await db.insert(books).values([
      { 
        title: 'Kafka: The Definitive Guide', 
        price: 4000, 
        // Changed coverColor to coverUrl
        coverUrl: 'https://m.media-amazon.com/images/I/91t7+l3+YqL._SY522_.jpg', 
        category: 'beginner' 
      },
      { 
        title: 'Mastering ksqlDB', 
        price: 5500, 
        // Changed coverColor to coverUrl
        coverUrl: 'https://m.media-amazon.com/images/I/71sVd9h1g+L._SY522_.jpg', 
        category: 'advanced' 
      },
      { 
        title: 'Event Patterns', 
        price: 3500, 
        // Changed coverColor to coverUrl
        coverUrl: 'https://m.media-amazon.com/images/I/81+2+9+yYXL._SY522_.jpg', 
        category: 'devops' 
      },
    ]);
    console.log('Done!');
  } catch (error) {
    console.error('Error seeding:', error);
  }
};

main();