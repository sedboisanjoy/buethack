-- Create the inventory table
CREATE TABLE inventory (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stock INT NOT NULL
);

-- Create the order_transactions table for idempotency
CREATE TABLE order_transactions (
    transaction_id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some sample data
INSERT INTO inventory (id, name, stock) VALUES ('item-123', 'FrostByte SSD', 100);
INSERT INTO inventory (id, name, stock) VALUES ('item-456', 'Valerix RAM', 200);
