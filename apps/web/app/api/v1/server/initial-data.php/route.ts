import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chromeStoreID = searchParams.get('chromeStoreID') || '';

    // Replicar exactamente la respuesta JSON de initial-data.php
    const responsePayload = {
      success: true,
      msg_id: 'initial_data_success',
      chromeStoreID: chromeStoreID,
      backend: 'https://wacrm.digital/', // Actualizado al nuevo dominio oficial
      update: {
        enabled: true,
      },
      webhooks: [],
      meet: {},
      migration: {},
      urls: {},
    };

    return NextResponse.json(responsePayload, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept'
      }
    });
  } catch (error) {
    console.error("Initial-Data API error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept'
    }
  });
}
